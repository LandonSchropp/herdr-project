import { stubModule } from "../test/helpers/module.ts";
import {
  applyProjectLayout,
  parseEventWorkspaceId,
  parseTabPaneId,
  parseWorkspaceDetails,
} from "./on-workspace.ts";
import { describe, expect, it, mock } from "bun:test";

describe("parseEventWorkspaceId", () => {
  describe("when the environment carries the id", () => {
    it("prefers it over the payload", () => {
      const json = JSON.stringify({ data: { workspace_id: "wFromPayload" } });

      expect(parseEventWorkspaceId(json, "wFromEnv")).toEqual("wFromEnv");
    });
  });

  describe("when only the payload carries the id", () => {
    it("reads it from the payload", () => {
      const json = JSON.stringify({ data: { workspace_id: "wG" } });

      expect(parseEventWorkspaceId(json, undefined)).toEqual("wG");
    });
  });

  describe("when the environment value is empty", () => {
    it("falls back to the payload", () => {
      const json = JSON.stringify({ data: { workspace_id: "wG" } });

      expect(parseEventWorkspaceId(json, "")).toEqual("wG");
    });
  });

  describe("when neither source carries an id", () => {
    it("returns null", () => {
      expect(parseEventWorkspaceId(JSON.stringify({ data: {} }), undefined)).toBeNull();
      expect(parseEventWorkspaceId(undefined, undefined)).toBeNull();
    });
  });

  describe("when the payload is not JSON", () => {
    it("returns null", () => {
      expect(parseEventWorkspaceId("{ not json", undefined)).toBeNull();
    });
  });
});

describe("parseWorkspaceDetails", () => {
  describe("when the workspace is backed by a worktree", () => {
    it("returns its repository, pane count, and active tab", () => {
      const response = {
        result: {
          workspace: {
            active_tab_id: "w0:t1",
            pane_count: 1,
            worktree: { repo_root: "/home/user/Notes" },
          },
        },
      };

      expect(parseWorkspaceDetails(response)).toEqual({
        repositoryRoot: "/home/user/Notes",
        paneCount: 1,
        activeTabId: "w0:t1",
      });
    });
  });

  describe("when a linked worktree reports its main repository", () => {
    it("returns the repository root rather than the checkout path", () => {
      const response = {
        result: {
          workspace: {
            active_tab_id: "w1:t1",
            pane_count: 1,
            worktree: {
              repo_root: "/home/user/Notes",
              checkout_path: "/home/user/.herdr/worktrees/Notes/feature",
            },
          },
        },
      };

      expect(parseWorkspaceDetails(response).repositoryRoot).toEqual("/home/user/Notes");
    });
  });

  describe("when the workspace has no worktree", () => {
    it("reports a null repository", () => {
      const response = { result: { workspace: { active_tab_id: "w0:t1", pane_count: 1 } } };

      expect(parseWorkspaceDetails(response).repositoryRoot).toBeNull();
    });
  });

  describe("when the response is not a workspace", () => {
    it("reports nothing usable", () => {
      expect(parseWorkspaceDetails({ nonsense: true })).toEqual({
        repositoryRoot: null,
        paneCount: 0,
        activeTabId: null,
      });
    });
  });
});

describe("parseTabPaneId", () => {
  const response = {
    result: {
      panes: [
        { pane_id: "w0:p1", tab_id: "w0:t1" },
        { pane_id: "w0:p2", tab_id: "w0:t2" },
      ],
    },
  };

  describe("when the tab has a pane", () => {
    it("returns its id", () => {
      expect(parseTabPaneId(response, "w0:t2")).toEqual("w0:p2");
    });
  });

  describe("when the tab has no pane", () => {
    it("returns null", () => {
      expect(parseTabPaneId(response, "w0:t9")).toBeNull();
    });
  });

  describe("when the response has no panes", () => {
    it("returns null", () => {
      expect(parseTabPaneId({ nonsense: true }, "w0:t1")).toBeNull();
    });
  });
});

/**
 * Replaces the modules `applyProjectLayout` leans on so it can be exercised without a running Herdr
 * session.
 *
 * @param options The responses each replaced module should give.
 * @param options.workspace The `workspace get` response.
 * @param options.panes The `pane list` response.
 * @param options.projects The projects `listProjects` reports.
 * @returns The mocks standing in for each replaced function.
 */
async function mockLayoutModules(options: {
  workspace: unknown;
  panes?: unknown;
  projects?: {
    name: string;
    repositoryRoot: string;
    tabs: { name: string; command: null }[];
    focusedTab: string | null;
  }[];
}) {
  const { workspace, panes = { result: { panes: [] } }, projects = [] } = options;

  const mocks = {
    applyLayout: mock(() => Promise.resolve()),
    listProjects: mock(() => Promise.resolve(projects)),
    runHerdrJson: mock((args: string[]) => Promise.resolve(args[0] === "pane" ? panes : workspace)),
  };

  await stubModule(import.meta.resolve("./layout.ts"), () => ({ applyLayout: mocks.applyLayout }));
  await stubModule(import.meta.resolve("./projects.ts"), () => ({
    listProjects: mocks.listProjects,
  }));
  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdrJson: mocks.runHerdrJson }));

  return mocks;
}

const TABS = [{ name: "shell", command: null }];

const PROJECT = {
  name: "notes",
  repositoryRoot: "/home/user/Notes",
  tabs: TABS,
  focusedTab: "shell",
};

const FRESH_WORKSPACE = {
  result: {
    workspace: {
      active_tab_id: "w1:t1",
      pane_count: 1,
      worktree: { repo_root: "/home/user/Notes" },
    },
  },
};

const ONE_PANE = { result: { panes: [{ pane_id: "w1:p1", tab_id: "w1:t1" }] } };

describe("applyProjectLayout", () => {
  describe("when a fresh workspace matches a project", () => {
    it("lays the project's tabs into it", async () => {
      const mocks = await mockLayoutModules({
        workspace: FRESH_WORKSPACE,
        panes: ONE_PANE,
        projects: [PROJECT],
      });

      const message = await applyProjectLayout("w1");

      expect(mocks.applyLayout).toHaveBeenCalledWith(
        {
          workspaceId: "w1",
          rootTabId: "w1:t1",
          rootPaneId: "w1:p1",
          repositoryRoot: "/home/user/Notes",
        },
        TABS,
        "shell",
      );
      expect(message).toContain("applied notes layout");
    });
  });

  describe("when the workspace has no worktree", () => {
    it("does nothing", async () => {
      const mocks = await mockLayoutModules({
        workspace: { result: { workspace: { active_tab_id: "w1:t1", pane_count: 1 } } },
        projects: [PROJECT],
      });

      expect(await applyProjectLayout("w1")).toContain("no worktree");
      expect(mocks.applyLayout).not.toHaveBeenCalled();
    });
  });

  describe("when the workspace already has its tabs", () => {
    it("does nothing", async () => {
      const mocks = await mockLayoutModules({
        workspace: {
          result: {
            workspace: {
              active_tab_id: "w1:t1",
              pane_count: 3,
              worktree: { repo_root: "/home/user/Notes" },
            },
          },
        },
        projects: [PROJECT],
      });

      expect(await applyProjectLayout("w1")).toContain("skipping layout");
      expect(mocks.applyLayout).not.toHaveBeenCalled();
    });
  });

  describe("when no project matches the repository", () => {
    it("does nothing", async () => {
      const mocks = await mockLayoutModules({
        workspace: FRESH_WORKSPACE,
        panes: ONE_PANE,
        projects: [],
      });

      expect(await applyProjectLayout("w1")).toContain("no project matches");
      expect(mocks.applyLayout).not.toHaveBeenCalled();
    });
  });

  describe("when the workspace reports no tab", () => {
    it("does nothing", async () => {
      const mocks = await mockLayoutModules({
        workspace: {
          result: {
            workspace: { pane_count: 1, worktree: { repo_root: "/home/user/Notes" } },
          },
        },
        projects: [PROJECT],
      });

      expect(await applyProjectLayout("w1")).toContain("no tab");
      expect(mocks.applyLayout).not.toHaveBeenCalled();
    });
  });

  describe("when the tab reports no pane", () => {
    it("does nothing", async () => {
      const mocks = await mockLayoutModules({
        workspace: FRESH_WORKSPACE,
        panes: { result: { panes: [] } },
        projects: [PROJECT],
      });

      expect(await applyProjectLayout("w1")).toContain("no pane");
      expect(mocks.applyLayout).not.toHaveBeenCalled();
    });
  });
});
