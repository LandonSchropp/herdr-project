import { mockSpawn } from "./herdr.test.ts";
import { applyLayout } from "./layout.ts";
import type { WorkspaceLayout } from "./types.ts";
import { describe, expect, it, spyOn } from "bun:test";

const WORKSPACE: WorkspaceLayout = {
  workspaceId: "wG",
  rootTabId: "wG:t1",
  rootPaneId: "wG:p1",
  checkoutPath: "/repo",
};

/**
 * Mocks `Bun.spawn` so each call returns the next queued response, letting a multi-step layout be
 * exercised without a running Herdr session.
 *
 * @param responses The stdout each successive call returns.
 * @returns The spy standing in for `Bun.spawn`, plus the argument lists it was called with.
 */
function mockSpawnSequence(responses: string[]) {
  let call = 0;

  const spawn = spyOn(Bun, "spawn").mockImplementation(() => {
    const stdout = responses[call] ?? "{}";
    call += 1;

    return {
      stdout: new Response(stdout).body,
      stderr: new Response("").body,
      exited: Promise.resolve(0),
    } as unknown as ReturnType<typeof Bun.spawn>;
  });

  return spawn;
}

/**
 * Collects the herdr arguments the spy was called with, dropping the leading binary name.
 *
 * @param spawn The spy standing in for `Bun.spawn`.
 * @returns One argument list per call.
 */
function callsOf(spawn: ReturnType<typeof mockSpawnSequence>): string[][] {
  return spawn.mock.calls.map((call) => call[0].slice(1));
}

describe("applyLayout", () => {
  describe("when the layout has no tabs", () => {
    it("does nothing", async () => {
      const spawn = mockSpawn("{}");

      await applyLayout(WORKSPACE, [], null, null);

      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe("when the first tab has a command", () => {
    it("renames the workspace's existing tab and runs the command in its pane", async () => {
      const spawn = mockSpawnSequence(["{}", "{}"]);

      await applyLayout(WORKSPACE, [{ name: "neovim", command: "nvim" }], null, null);

      expect(callsOf(spawn)).toEqual([
        ["tab", "rename", "wG:t1", "neovim"],
        ["pane", "run", "wG:p1", "nvim"],
      ]);
    });
  });

  describe("when a tab has no command", () => {
    it("leaves it as a plain shell", async () => {
      const spawn = mockSpawnSequence(["{}"]);

      await applyLayout(WORKSPACE, [{ name: "shell", command: null }], null, null);

      expect(callsOf(spawn)).toEqual([["tab", "rename", "wG:t1", "shell"]]);
    });
  });

  describe("when the layout has more than one tab", () => {
    it("creates the remaining tabs and runs their commands", async () => {
      const spawn = mockSpawnSequence([
        "{}",
        JSON.stringify({ result: { root_pane: { pane_id: "wG:p2" } } }),
        "{}",
      ]);

      await applyLayout(
        WORKSPACE,
        [
          { name: "shell", command: null },
          { name: "neovim", command: "nvim" },
        ],
        null,
        null,
      );

      expect(callsOf(spawn)).toEqual([
        ["tab", "rename", "wG:t1", "shell"],
        ["tab", "create", "--workspace", "wG", "--cwd", "/repo", "--label", "neovim", "--no-focus"],
        ["pane", "run", "wG:p2", "nvim"],
      ]);
    });
  });

  describe("when a later tab is the focused tab", () => {
    it("creates it focused", async () => {
      const spawn = mockSpawnSequence([
        "{}",
        JSON.stringify({ result: { root_pane: { pane_id: "wG:p2" } } }),
        "{}",
      ]);

      await applyLayout(
        WORKSPACE,
        [
          { name: "shell", command: null },
          { name: "neovim", command: "nvim" },
        ],
        "neovim",
        null,
      );

      expect(callsOf(spawn)).toEqual([
        ["tab", "rename", "wG:t1", "shell"],
        ["tab", "create", "--workspace", "wG", "--cwd", "/repo", "--label", "neovim", "--focus"],
        ["pane", "run", "wG:p2", "nvim"],
      ]);
    });
  });

  describe("when the first tab is the focused tab", () => {
    it("leaves the root tab focused and creates the rest unfocused", async () => {
      const spawn = mockSpawnSequence(["{}", "{}"]);

      await applyLayout(
        WORKSPACE,
        [
          { name: "shell", command: null },
          { name: "neovim", command: null },
        ],
        "shell",
        null,
      );

      expect(callsOf(spawn)).toEqual([
        ["tab", "rename", "wG:t1", "shell"],
        ["tab", "create", "--workspace", "wG", "--cwd", "/repo", "--label", "neovim", "--no-focus"],
      ]);
    });
  });

  describe("when a prompt is given", () => {
    describe("when the prompt tab is the first tab and it has a command", () => {
      it("prefixes the command with the prompt env var", async () => {
        const spawn = mockSpawnSequence(["{}", "{}"]);

        await applyLayout(
          WORKSPACE,
          [{ name: "claude", command: "claude" }],
          "claude",
          "fix the bug",
        );

        expect(callsOf(spawn)).toEqual([
          ["tab", "rename", "wG:t1", "claude"],
          ["pane", "run", "wG:p1", "AGENT_PROMPT='fix the bug' claude"],
        ]);
      });
    });

    describe("when the prompt tab is the first tab and it has no command", () => {
      it("exports the prompt env var into the plain shell", async () => {
        const spawn = mockSpawnSequence(["{}", "{}"]);

        await applyLayout(WORKSPACE, [{ name: "shell", command: null }], "shell", "fix the bug");

        expect(callsOf(spawn)).toEqual([
          ["tab", "rename", "wG:t1", "shell"],
          ["pane", "run", "wG:p1", "export AGENT_PROMPT='fix the bug'"],
        ]);
      });
    });

    describe("when the prompt tab is a later tab", () => {
      it("creates it with the prompt env var and runs its command unprefixed", async () => {
        const spawn = mockSpawnSequence([
          "{}",
          JSON.stringify({ result: { root_pane: { pane_id: "wG:p2" } } }),
          "{}",
        ]);

        await applyLayout(
          WORKSPACE,
          [
            { name: "shell", command: null },
            { name: "claude", command: "claude" },
          ],
          "claude",
          "fix the bug",
        );

        expect(callsOf(spawn)).toEqual([
          ["tab", "rename", "wG:t1", "shell"],
          [
            "tab",
            "create",
            "--workspace",
            "wG",
            "--cwd",
            "/repo",
            "--label",
            "claude",
            "--env",
            "AGENT_PROMPT=fix the bug",
            "--focus",
          ],
          ["pane", "run", "wG:p2", "claude"],
        ]);
      });
    });

    describe("when the prompt tab has a single quote in the prompt", () => {
      it("escapes it for the shell", async () => {
        const spawn = mockSpawnSequence(["{}", "{}"]);

        await applyLayout(
          WORKSPACE,
          [{ name: "claude", command: "claude" }],
          "claude",
          "fix the user's bug",
        );

        expect(callsOf(spawn)).toEqual([
          ["tab", "rename", "wG:t1", "claude"],
          ["pane", "run", "wG:p1", "AGENT_PROMPT='fix the user'\"'\"'s bug' claude"],
        ]);
      });
    });

    describe("when no tab matches the focused tab", () => {
      it("ignores the prompt", async () => {
        const spawn = mockSpawnSequence(["{}"]);

        await applyLayout(WORKSPACE, [{ name: "shell", command: null }], null, "fix the bug");

        expect(callsOf(spawn)).toEqual([["tab", "rename", "wG:t1", "shell"]]);
      });
    });
  });
});
