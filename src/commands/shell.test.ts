import { runAttachedCommand, runCommand, runDetachedCommand } from "./shell.ts";
import { describe, expect, it, mock } from "bun:test";

const unrefMock = mock(() => {});
const spawnMock = mock(() => ({ unref: unrefMock }));

await mock.module("node:child_process", () => ({
  spawn: spawnMock,
}));

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
    it("throws", () => {
      expect(runCommand(["false"])).rejects.toThrow();
    });

    it("includes the command's output in the error", () => {
      expect(runCommand(["sh", "-c", "echo boom; exit 1"])).rejects.toThrow("boom");
    });
  });

  describe("when the command is not found", () => {
    it("throws", () => {
      expect(runCommand(["notarealcommand"])).rejects.toThrow();
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
