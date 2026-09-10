import { stubModule } from "../test/helpers/module.ts";
import { listOpenWorkspaces, parseReportedWorkspaces } from "./open-workspaces.ts";
import { describe, expect, it, mock } from "bun:test";

/**
 * Builds a `runHerdrJson` mock that answers `workspace list` with the given workspaces and `pane
 * list` with the given panes, which is what {@link listOpenWorkspaces} reads.
 *
 * @param workspaces The workspace entries to report.
 * @param panes The pane entries to report.
 * @returns The mock standing in for `runHerdrJson`.
 */
function mockRunHerdrJson(workspaces: unknown[], panes: unknown[] = []) {
  return mock((args: string[]) =>
    Promise.resolve(args[0] === "pane" ? { result: { panes } } : { result: { workspaces } }),
  );
}

describe("parseReportedWorkspaces", () => {
  describe("when Herdr manages the workspace's worktree", () => {
    it("reports the worktree", () => {
      const workspaces = {
        result: {
          workspaces: [
            {
              workspace_id: "w1",
              worktree: { checkout_path: "/tmp/orc", repo_root: "/tmp/orc" },
            },
          ],
        },
      };

      expect(parseReportedWorkspaces(workspaces, {})[0]?.worktree).toEqual({
        checkoutPath: "/tmp/orc",
        repositoryRoot: "/tmp/orc",
      });
    });
  });

  describe("when Herdr manages no worktree for the workspace", () => {
    it("reports no worktree", () => {
      const workspaces = {
        result: { workspaces: [{ workspace_id: "w1", worktree: null }] },
      };

      expect(parseReportedWorkspaces(workspaces, {})[0]?.worktree).toBeNull();
    });

    it("reports the directory of its first pane", () => {
      const workspaces = { result: { workspaces: [{ workspace_id: "w1" }] } };
      const panes = {
        result: {
          panes: [
            { workspace_id: "w1", cwd: "/tmp/feature" },
            { workspace_id: "w1", cwd: "/tmp/elsewhere" },
          ],
        },
      };

      expect(parseReportedWorkspaces(workspaces, panes)[0]?.paneDirectory).toEqual("/tmp/feature");
    });
  });

  describe("when the workspace has no pane", () => {
    it("reports no directory", () => {
      const workspaces = { result: { workspaces: [{ workspace_id: "w1" }] } };
      const panes = {
        result: { panes: [{ workspace_id: "w2", cwd: "/tmp/other" }] },
      };

      expect(parseReportedWorkspaces(workspaces, panes)[0]?.paneDirectory).toBeNull();
    });
  });

  describe("when a pane names no workspace", () => {
    it("skips it", () => {
      const workspaces = { result: { workspaces: [{ workspace_id: "w1" }] } };
      const panes = {
        result: { panes: [{ cwd: "/tmp/orphan" }, { workspace_id: "w1" }] },
      };

      expect(parseReportedWorkspaces(workspaces, panes)[0]?.paneDirectory).toBeNull();
    });
  });

  describe("when a workspace entry has no id", () => {
    it("leaves it out", () => {
      const workspaces = { result: { workspaces: [{ label: "plain" }] } };

      expect(parseReportedWorkspaces(workspaces, {})).toEqual([]);
    });
  });

  describe("when the response is not a workspace listing", () => {
    it("returns an empty list", () => {
      expect(parseReportedWorkspaces({ nonsense: true }, {})).toEqual([]);
    });
  });
});

describe("listOpenWorkspaces", () => {
  /**
   * Replaces the herdr and git modules so {@link listOpenWorkspaces} can be exercised without a
   * running Herdr session.
   *
   * @param workspaces The workspace entries `workspace list` reports.
   * @param panes The pane entries `pane list` reports.
   * @param repositoryRoot The repository `mainCheckoutPath` resolves a pane's directory to.
   */
  async function mockListModules(
    workspaces: unknown[],
    panes: unknown[] = [],
    repositoryRoot: string | null = null,
  ) {
    await stubModule(import.meta.resolve("./herdr.ts"), () => ({
      runHerdrJson: mockRunHerdrJson(workspaces, panes),
    }));
    await stubModule(import.meta.resolve("./git.ts"), () => ({
      mainCheckoutPath: mock(() => Promise.resolve(repositoryRoot)),
    }));
  }

  describe("when Herdr manages the workspace's worktree", () => {
    it("returns the worktree Herdr reports", async () => {
      await mockListModules([
        {
          workspace_id: "w1",
          worktree: { checkout_path: "/tmp/feature", repo_root: "/tmp/orc" },
        },
      ]);

      expect(await listOpenWorkspaces()).toEqual([
        {
          workspaceId: "w1",
          checkoutPath: "/tmp/feature",
          repositoryRoot: "/tmp/orc",
          isManagedWorktree: true,
        },
      ]);
    });
  });

  describe("when Herdr manages no worktree for the workspace", () => {
    it("resolves the repository from the pane's directory", async () => {
      await mockListModules(
        [{ workspace_id: "w1" }],
        [{ workspace_id: "w1", cwd: "/tmp/feature" }],
        "/tmp/orc",
      );

      expect(await listOpenWorkspaces()).toEqual([
        {
          workspaceId: "w1",
          checkoutPath: "/tmp/feature",
          repositoryRoot: "/tmp/orc",
          isManagedWorktree: false,
        },
      ]);
    });
  });

  describe("when the pane's directory is not in a repository", () => {
    it("leaves the workspace out", async () => {
      await mockListModules([{ workspace_id: "w1" }], [{ workspace_id: "w1", cwd: "/tmp" }], null);

      expect(await listOpenWorkspaces()).toEqual([]);
    });
  });

  describe("when the workspace has no pane", () => {
    it("leaves the workspace out", async () => {
      await mockListModules([{ workspace_id: "w1" }]);

      expect(await listOpenWorkspaces()).toEqual([]);
    });
  });
});
