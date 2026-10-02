import {
  HerdrTimeoutError,
  focusedWorkspaceId,
  parseCheckoutPath,
  parseFocusedWorkspaceId,
  parseRootPaneId,
  parseWorkspace,
  runHerdr,
  runHerdrJson,
} from "./herdr.ts";
import { describe, expect, it, mock, spyOn } from "bun:test";

const WORKSPACE_RESPONSE = {
  result: {
    root_pane: { pane_id: "wG:p1" },
    tab: { tab_id: "wG:t1" },
    workspace: { workspace_id: "wG" },
  },
};

/**
 * Mocks `Bun.spawn` so the herdr CLI wrapper can be exercised without a running Herdr session.
 *
 * @param stdout The text the fake process writes to stdout.
 * @param options The exit code and stderr text the fake process reports.
 * @param options.exitCode The code the fake process exits with.
 * @param options.stderr The text the fake process writes to stderr.
 * @returns The spy standing in for `Bun.spawn`.
 */
export function mockSpawn(stdout: string, options: { exitCode?: number; stderr?: string } = {}) {
  return spyOn(Bun, "spawn").mockReturnValue(fakeProcess(stdout, options));
}

/**
 * Builds a stand-in for a finished process, for queuing one `Bun.spawn` result at a time.
 *
 * @param stdout The text the fake process writes to stdout.
 * @param options The exit code and stderr text the fake process reports.
 * @param options.exitCode The code the fake process exits with.
 * @param options.stderr The text the fake process writes to stderr.
 * @returns The fake process.
 */
function fakeProcess(stdout: string, options: { exitCode?: number; stderr?: string } = {}) {
  const { exitCode = 0, stderr = "" } = options;

  return {
    stdout: new Response(stdout).body,
    stderr: new Response(stderr).body,
    exited: Promise.resolve(exitCode),
    kill: () => {},
    unref: () => {},
  } as unknown as ReturnType<typeof Bun.spawn>;
}

const SERVER_NOT_RUNNING = {
  exitCode: 1,
  stderr: '{"error":{"code":"server_not_running","message":"no herdr server is running"}}',
};

/**
 * Mocks `Bun.spawn` as a command that never finishes and never closes its output, which is what a
 * command outliving its timeout looks like.
 *
 * @returns The spy standing in for `Bun.spawn`.
 */
function mockHangingSpawn() {
  return spyOn(Bun, "spawn").mockReturnValue({
    stdout: new ReadableStream(),
    stderr: new ReadableStream(),
    exited: new Promise<number>(() => {}),
    kill: () => {},
  } as unknown as ReturnType<typeof Bun.spawn>);
}

describe("runHerdr", () => {
  describe("when the command succeeds", () => {
    it("returns its raw output", async () => {
      const spawn = mockSpawn("plain output");

      expect(await runHerdr(["pane", "run", "wG:p1", "nvim"])).toEqual("plain output");
      expect(spawn).toHaveBeenCalledWith(
        ["herdr", "pane", "run", "wG:p1", "nvim"],
        expect.anything(),
      );
    });
  });

  describe("when the command prints nothing", () => {
    it("returns an empty string rather than throwing", async () => {
      mockSpawn("");

      expect(await runHerdr(["pane", "run", "wG:p1", "nvim"])).toEqual("");
    });
  });

  describe("when the command exits non-zero", () => {
    it("throws with the reported error", async () => {
      mockSpawn("", { exitCode: 1, stderr: "not a repository" });

      const thrown = await runHerdr(["worktree", "list"]).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("not a repository");
    });
  });

  describe("when no server is running", () => {
    it("starts a detached headless server", async () => {
      const spawn = spyOn(Bun, "spawn")
        .mockReturnValueOnce(fakeProcess("", SERVER_NOT_RUNNING))
        .mockReturnValueOnce(fakeProcess(""))
        .mockReturnValueOnce(fakeProcess('{"running":true}'))
        .mockReturnValueOnce(fakeProcess("[]"));

      await runHerdr(["workspace", "list"]);

      expect(spawn).toHaveBeenCalledWith(
        ["herdr", "server"],
        expect.objectContaining({ detached: true }),
      );
    });

    it("retries the command once the server is ready", async () => {
      spyOn(Bun, "spawn")
        .mockReturnValueOnce(fakeProcess("", SERVER_NOT_RUNNING))
        .mockReturnValueOnce(fakeProcess(""))
        .mockReturnValueOnce(fakeProcess('{"running":false}'))
        .mockReturnValueOnce(fakeProcess('{"running":true}'))
        .mockReturnValueOnce(fakeProcess("[]"));
      spyOn(Bun, "sleep").mockResolvedValue();

      expect(await runHerdr(["workspace", "list"])).toEqual("[]");
    });

    describe("when the server never becomes ready", () => {
      it("throws", async () => {
        spyOn(Bun, "spawn").mockImplementation(((command: string[]) =>
          command[1] === "status"
            ? fakeProcess('{"running":false}')
            : fakeProcess("", SERVER_NOT_RUNNING)) as unknown as typeof Bun.spawn);
        spyOn(Bun, "sleep").mockResolvedValue();

        const thrown = await runHerdr(["workspace", "list"]).catch((error: Error) => error);

        expect((thrown as Error).message).toContain("did not start");
      });
    });
  });

  describe("when the command outlives its timeout", () => {
    it("throws a HerdrTimeoutError", async () => {
      mockHangingSpawn();

      const thrown = await runHerdr(["agent", "list"], 50).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(HerdrTimeoutError);
      expect((thrown as Error).message).toContain("timed out");
    });

    it("kills the command and releases its output", async () => {
      const kill = mock(() => {});
      const cancel = mock(() => Promise.resolve());

      spyOn(Bun, "spawn").mockReturnValue({
        stdout: { getReader: () => ({ read: () => new Promise(() => {}), cancel }) },
        stderr: { getReader: () => ({ read: () => new Promise(() => {}), cancel }) },
        exited: new Promise<number>(() => {}),
        kill,
      } as unknown as ReturnType<typeof Bun.spawn>);

      await runHerdr(["agent", "list"], 50).catch(() => undefined);

      expect(kill).toHaveBeenCalled();
      expect(cancel).toHaveBeenCalledTimes(2);
    });
  });
});

describe("runHerdrJson", () => {
  describe("when the command prints JSON", () => {
    it("returns the parsed response", async () => {
      mockSpawn('{"ok":true}');

      expect(await runHerdrJson(["pane", "list"])).toEqual({ ok: true });
    });
  });

  describe("when the command prints something other than JSON", () => {
    it("throws", async () => {
      mockSpawn("not json");

      const thrown = await runHerdrJson(["worktree", "list"]).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("did not print JSON");
    });
  });
});

describe("parseRootPaneId", () => {
  describe("when the response describes a pane", () => {
    it("returns its id", () => {
      expect(parseRootPaneId(WORKSPACE_RESPONSE)).toEqual("wG:p1");
    });
  });

  describe("when the response describes no pane", () => {
    it("throws", () => {
      expect(() => parseRootPaneId({ result: {} })).toThrow("did not report a pane");
    });
  });
});

describe("parseWorkspace", () => {
  describe("when the response describes a workspace", () => {
    it("returns its workspace, tab, and pane ids", () => {
      expect(parseWorkspace(WORKSPACE_RESPONSE)).toEqual({
        workspaceId: "wG",
        rootTabId: "wG:t1",
        rootPaneId: "wG:p1",
      });
    });
  });

  describe("when the response describes no workspace", () => {
    it("throws", () => {
      expect(() => parseWorkspace({ result: { root_pane: { pane_id: "wG:p1" } } })).toThrow(
        "did not report a workspace",
      );
    });
  });
});

describe("parseCheckoutPath", () => {
  describe("when the response describes a worktree", () => {
    it("returns its checkout path", () => {
      const response = {
        result: { workspace: { worktree: { checkout_path: "/tmp/orc" } } },
      };

      expect(parseCheckoutPath(response)).toEqual("/tmp/orc");
    });
  });

  describe("when the response describes no worktree", () => {
    it("returns null", () => {
      expect(parseCheckoutPath({ result: { workspace: {} } })).toBeNull();
    });
  });

  describe("when the response describes no workspace", () => {
    it("returns null", () => {
      expect(parseCheckoutPath({ nonsense: true })).toBeNull();
    });
  });
});

describe("parseFocusedWorkspaceId", () => {
  describe("when the snapshot names a focused workspace", () => {
    it("returns its id", () => {
      const response = { result: { snapshot: { focused_workspace_id: "wG" } } };

      expect(parseFocusedWorkspaceId(response)).toEqual("wG");
    });
  });

  describe("when the snapshot names no focused workspace", () => {
    it("returns null", () => {
      expect(parseFocusedWorkspaceId({ result: { snapshot: {} } })).toBeNull();
    });
  });

  describe("when the response is not shaped like a snapshot", () => {
    it("returns null", () => {
      expect(parseFocusedWorkspaceId({ nonsense: true })).toBeNull();
    });
  });
});

describe("focusedWorkspaceId", () => {
  it("returns the id of the workspace the session is showing", async () => {
    const spawn = mockSpawn(
      JSON.stringify({ result: { snapshot: { focused_workspace_id: "wG" } } }),
    );

    expect(await focusedWorkspaceId()).toEqual("wG");
    expect(spawn).toHaveBeenCalledWith(["herdr", "api", "snapshot"], expect.anything());
  });
});
