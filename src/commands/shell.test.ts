import { CommandError, runAttachedCommand, runCommand, runDetachedCommand } from "./shell.ts";
import { describe, expect, it, mock } from "bun:test";
import { chmod } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const unrefMock = mock(() => {});
const spawnMock = mock(() => ({ unref: unrefMock }));

await mock.module("node:child_process", () => ({
  spawn: spawnMock,
}));

const waitMock = mock(() => Promise.resolve());

await mock.module("../utilities/wait.ts", () => ({
  wait: waitMock,
}));

/**
 * Writes an executable script that exits non-zero its first `failures` runs, then exits zero,
 * tracking run count in a sibling file so the count survives across separate invocations.
 *
 * @param failures The number of leading runs that should fail before the script succeeds.
 * @returns The command that runs the script.
 */
async function flakeyCommand(failures: number): Promise<string[]> {
  const directory = await mkdtemp(join(tmpdir(), "orc-retry-"));
  const counter = join(directory, "count");
  const script = join(directory, "flake.sh");

  await Bun.write(counter, "0");
  await Bun.write(
    script,
    [
      "#!/bin/sh",
      `count=$(cat "${counter}")`,
      "count=$((count + 1))",
      `echo "$count" > "${counter}"`,
      `if [ "$count" -le ${failures} ]; then echo "fail $count" >&2; exit 1; fi`,
      'echo "ok"',
    ].join("\n"),
  );
  await chmod(script, 0o755);

  return [script];
}

describe("runCommand", () => {
  describe("when the command prints to stdout", () => {
    it("captures stdout", async () => {
      const { stdout } = await runCommand(["echo", "hello"]);
      expect(stdout.trim()).toBe("hello");
    });
  });

  describe("when the command prints to stderr", () => {
    it("captures stderr", async () => {
      const { stderr } = await runCommand(["sh", "-c", "echo hello >&2"]);
      expect(stderr.trim()).toBe("hello");
    });
  });

  describe("when the command fails", () => {
    it("throws a CommandError", () => {
      expect(runCommand(["false"])).rejects.toBeInstanceOf(CommandError);
    });

    it("includes the command's output in the error", () => {
      expect(runCommand(["sh", "-c", "echo boom; exit 1"])).rejects.toThrow("boom");
    });

    it("carries the command, exit code, and output", async () => {
      const command = ["sh", "-c", "echo out; echo err >&2; exit 3"];
      const error = (await runCommand(command).catch((caught: unknown) => caught)) as CommandError;

      expect(error.command).toEqual(command);
      expect(error.exitCode).toBe(3);
      expect(error.stdout.trim()).toBe("out");
      expect(error.stderr.trim()).toBe("err");
    });
  });

  describe("when the command is not found", () => {
    it("throws", () => {
      expect(runCommand(["notarealcommand"])).rejects.toThrow();
    });
  });

  describe("when retries is set", () => {
    describe("when the command fails then succeeds within the retry budget", () => {
      it("returns the successful result", async () => {
        const command = await flakeyCommand(1);
        const { stdout } = await runCommand(command, { retries: 1 });
        expect(stdout.trim()).toBe("ok");
      });

      it("waits between attempts", async () => {
        const command = await flakeyCommand(1);
        await runCommand(command, { retries: 1 });
        expect(waitMock).toHaveBeenCalledWith(100);
      });
    });

    describe("when the command keeps failing past the retry budget", () => {
      it("throws a CommandError after exhausting the retries", async () => {
        const command = await flakeyCommand(5);
        expect(runCommand(command, { retries: 2 })).rejects.toBeInstanceOf(CommandError);
      });

      it("retries the command the given number of times", async () => {
        const command = await flakeyCommand(5);
        await runCommand(command, { retries: 2 }).catch(() => {});
        expect(waitMock).toHaveBeenCalledTimes(2);
      });
    });

    describe("when the command succeeds on the first attempt", () => {
      it("does not wait", async () => {
        await runCommand(["true"], { retries: 2 });
        expect(waitMock).not.toHaveBeenCalled();
      });
    });
  });

  describe("when a non-spawn error occurs", () => {
    it("rethrows the error", async () => {
      const tmpFile = "/tmp/orc-test-no-exec";
      await Bun.write(tmpFile, "#!/bin/sh\necho hello");
      // No execute permission — Bun.spawn throws EACCES, not ENOENT
      expect(runCommand([tmpFile])).rejects.toThrow();
    });
  });

  describe("when the error option is false", () => {
    describe("when the command succeeds", () => {
      it("returns exit code 0", async () => {
        const { exitCode } = await runCommand(["echo", "hello"], { error: false });
        expect(exitCode).toBe(0);
      });
    });

    describe("when the command fails", () => {
      it("returns a non-zero exit code without throwing", async () => {
        const { exitCode } = await runCommand(["false"], { error: false });
        expect(exitCode).not.toBe(0);
      });
    });

    describe("when the command is not found", () => {
      it("returns exit code 127", async () => {
        const { exitCode } = await runCommand(["notarealcommand"], { error: false });
        expect(exitCode).toBe(127);
      });
    });
  });
});

describe("runAttachedCommand", () => {
  describe("when the command succeeds", () => {
    it("returns exit code 0", async () => {
      expect(await runAttachedCommand(["true"])).toBe(0);
    });
  });

  describe("when the command fails", () => {
    it("returns a non-zero exit code without throwing", async () => {
      expect(await runAttachedCommand(["false"])).not.toBe(0);
    });
  });

  describe("when the command is not found", () => {
    it("returns exit code 127", async () => {
      expect(await runAttachedCommand(["notarealcommand"])).toBe(127);
    });
  });

  describe("when a non-spawn error occurs", () => {
    it("rethrows the error", async () => {
      const tmpFile = "/tmp/orc-test-no-exec-attached";
      await Bun.write(tmpFile, "#!/bin/sh\ntrue");
      expect(runAttachedCommand([tmpFile])).rejects.toThrow();
    });
  });
});

describe("runDetachedCommand", () => {
  it("spawns the command detached in the given directory with ignored stdio, then unrefs it", () => {
    runDetachedCommand(["orc", "delete", "orc", "tui"], { cwd: "/stable", env: { ORC_X: "1" } });

    expect(spawnMock).toHaveBeenCalledWith(
      "orc",
      ["delete", "orc", "tui"],
      expect.objectContaining({ cwd: "/stable", detached: true, stdio: "ignore" }),
    );
    expect(unrefMock).toHaveBeenCalled();
  });
});
