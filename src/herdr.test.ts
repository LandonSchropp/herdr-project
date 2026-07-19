import { parseRootPaneId, parseWorkspace, runHerdr, runHerdrJson } from "./herdr.ts";
import { describe, expect, it, spyOn } from "bun:test";

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
  const { exitCode = 0, stderr = "" } = options;

  return spyOn(Bun, "spawn").mockReturnValue({
    stdout: new Response(stdout).body,
    stderr: new Response(stderr).body,
    exited: Promise.resolve(exitCode),
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
