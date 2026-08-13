import { stubModule } from "../test/helpers/module.ts";
import type { Project } from "./types.ts";
import {
  closeProjectMain,
  closeProjectWorktree,
  createProjectWorktree,
  listProjectRows,
  openProjectMain,
  openProjectWorktree,
  parseOpenCheckoutPaths,
  parseOpenWorkspaceId,
  parseOpenWorktrees,
  workspaceRepositoryRoot,
} from "./workspaces.ts";
import { describe, expect, it, mock } from "bun:test";

const TABS = [{ name: "shell", command: null }];

const PROJECT: Project = { name: "orc", repositoryRoot: "/tmp/orc", tabs: TABS, focusedTab: null };

const WORKSPACE = { workspaceId: "wG", rootTabId: "wG:t1", rootPaneId: "wG:p1" };

const CREATED_WORKSPACE = { ...WORKSPACE, checkoutPath: "/tmp/worktrees/feature" };

/**
 * Replaces the herdr, worktree, and layout modules so the workspace helpers can be exercised
 * without a running Herdr session.
 *
 * @param worktrees The worktrees `listWorktrees` reports.
 * @param openPaths The checkout paths that already have a workspace open.
 * @returns The mocks standing in for each replaced function.
 */
async function mockHerdrModules(
  worktrees: { branch: string; path: string; isMain: boolean }[],
  openPaths: string[] = [],
) {
  const mocks = {
    applyLayout: mock(() => Promise.resolve()),
    openWorktree: mock(() => Promise.resolve(WORKSPACE)),
    createWorktree: mock(() => Promise.resolve(CREATED_WORKSPACE)),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
    writePendingPrompt: mock(() => Promise.resolve()),
    runHerdrJson: mock(() =>
      Promise.resolve({
        result: { workspaces: openPaths.map((path) => ({ worktree: { checkout_path: path } })) },
      }),
    ),
  };

  await stubModule(import.meta.resolve("./layout.ts"), () => ({ applyLayout: mocks.applyLayout }));
  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdrJson: mocks.runHerdrJson }));
  await stubModule(import.meta.resolve("./worktrees.ts"), () => ({
    openWorktree: mocks.openWorktree,
    createWorktree: mocks.createWorktree,
    listWorktrees: mocks.listWorktrees,
  }));
  await stubModule(import.meta.resolve("./pending-prompt.ts"), () => ({
    writePendingPrompt: mocks.writePendingPrompt,
  }));

  return mocks;
}

describe("openProjectWorktree", () => {
  it("opens the worktree and leaves the tabs to the workspace.created hook", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

    expect(mocks.openWorktree).toHaveBeenCalledWith(
      "/tmp/orc",
      "/tmp/worktrees/feature",
      undefined,
    );
    expect(mocks.applyLayout).not.toHaveBeenCalled();
  });
});

describe("openProjectWorktree with a prompt", () => {
  it("records the prompt for the worktree's checkout path before opening it", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature", undefined, "fix the bug");

    expect(mocks.writePendingPrompt).toHaveBeenCalledWith("/tmp/worktrees/feature", "fix the bug");
  });
});

describe("openProjectWorktree without a prompt", () => {
  it("records nothing", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

    expect(mocks.writePendingPrompt).not.toHaveBeenCalled();
  });
});

describe("openProjectWorktree when the worktree already has a workspace", () => {
  it("refuses rather than laying a second set of tabs into it", async () => {
    const mocks = await mockHerdrModules([], ["/tmp/worktrees/feature"]);

    const thrown = await openProjectWorktree(PROJECT, "/tmp/worktrees/feature").catch(
      (error: Error) => error,
    );

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("already open");
    expect(mocks.openWorktree).not.toHaveBeenCalled();
    expect(mocks.applyLayout).not.toHaveBeenCalled();
  });
});

describe("createProjectWorktree", () => {
  it("creates the worktree and leaves the tabs to the workspace.created hook", async () => {
    const mocks = await mockHerdrModules([]);

    await createProjectWorktree(PROJECT, "feature");

    expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature");
    expect(mocks.applyLayout).not.toHaveBeenCalled();
  });

  describe("when the branch already has a worktree", () => {
    it("opens it instead of creating a second one", async () => {
      const mocks = await mockHerdrModules([
        { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
      ]);

      await createProjectWorktree(PROJECT, "feature");

      expect(mocks.createWorktree).not.toHaveBeenCalled();
      expect(mocks.openWorktree).toHaveBeenCalledWith(
        "/tmp/orc",
        "/tmp/worktrees/feature",
        undefined,
      );
    });
  });

  describe("when the branch's worktree already has a workspace", () => {
    it("refuses rather than laying a second set of tabs into it", async () => {
      const mocks = await mockHerdrModules(
        [{ branch: "feature", path: "/tmp/worktrees/feature", isMain: false }],
        ["/tmp/worktrees/feature"],
      );

      const thrown = await createProjectWorktree(PROJECT, "feature").catch((error: Error) => error);

      expect((thrown as Error).message).toContain("already open");
      expect(mocks.createWorktree).not.toHaveBeenCalled();
    });
  });
});

describe("createProjectWorktree with a prompt", () => {
  it("records the prompt for the checkout path Herdr reports", async () => {
    const mocks = await mockHerdrModules([]);

    await createProjectWorktree(PROJECT, "feature", "fix the bug");

    expect(mocks.writePendingPrompt).toHaveBeenCalledWith("/tmp/worktrees/feature", "fix the bug");
  });

  describe("when the branch already has a worktree", () => {
    it("records the prompt for that worktree's checkout path", async () => {
      const mocks = await mockHerdrModules([
        { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
      ]);

      await createProjectWorktree(PROJECT, "feature", "fix the bug");

      expect(mocks.writePendingPrompt).toHaveBeenCalledWith(
        "/tmp/worktrees/feature",
        "fix the bug",
      );
    });
  });
});

describe("openProjectMain", () => {
  describe("when the repository has a main worktree", () => {
    it("opens it, naming the workspace after the project", async () => {
      const mocks = await mockHerdrModules([
        { branch: "feature", path: "/tmp/feature", isMain: false },
        { branch: "main", path: "/tmp/orc", isMain: true },
      ]);

      await openProjectMain(PROJECT);

      expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "orc");
    });
  });

  describe("when a prompt is given", () => {
    it("records it for the main worktree's checkout path", async () => {
      const mocks = await mockHerdrModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

      await openProjectMain(PROJECT, "fix the bug");

      expect(mocks.writePendingPrompt).toHaveBeenCalledWith("/tmp/orc", "fix the bug");
    });
  });

  describe("when the repository has no main worktree", () => {
    it("throws", async () => {
      await mockHerdrModules([]);

      const thrown = await openProjectMain(PROJECT).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("no main worktree");
    });
  });
});

describe("parseOpenCheckoutPaths", () => {
  describe("when workspaces are backed by worktrees", () => {
    it("returns their checkout paths without duplicates", () => {
      const response = {
        result: {
          workspaces: [
            { worktree: { checkout_path: "/tmp/orc" } },
            { worktree: { checkout_path: "/tmp/feature" } },
            { worktree: { checkout_path: "/tmp/orc" } },
          ],
        },
      };

      expect(parseOpenCheckoutPaths(response)).toEqual(["/tmp/orc", "/tmp/feature"]);
    });
  });

  describe("when a workspace has no worktree", () => {
    it("skips it", () => {
      const response = { result: { workspaces: [{ worktree: null }, { label: "plain" }] } };

      expect(parseOpenCheckoutPaths(response)).toEqual([]);
    });
  });

  describe("when the response is not a workspace listing", () => {
    it("returns an empty list", () => {
      expect(parseOpenCheckoutPaths({ nonsense: true })).toEqual([]);
    });
  });
});

describe("parseOpenWorkspaceId", () => {
  describe("when a workspace is open for the path", () => {
    it("returns its id", () => {
      const response = {
        result: {
          workspaces: [
            { workspace_id: "w1", worktree: { checkout_path: "/tmp/orc" } },
            { workspace_id: "w2", worktree: { checkout_path: "/tmp/feature" } },
          ],
        },
      };

      expect(parseOpenWorkspaceId(response, "/tmp/feature")).toEqual("w2");
    });
  });

  describe("when no workspace is open for the path", () => {
    it("returns null", () => {
      const response = {
        result: { workspaces: [{ workspace_id: "w1", worktree: { checkout_path: "/tmp/orc" } }] },
      };

      expect(parseOpenWorkspaceId(response, "/tmp/feature")).toBeNull();
    });
  });

  describe("when the response is not a workspace listing", () => {
    it("returns null", () => {
      expect(parseOpenWorkspaceId({ nonsense: true }, "/tmp/feature")).toBeNull();
    });
  });
});

/**
 * Replaces the herdr and worktree modules so {@link closeProjectMain} and
 * {@link closeProjectWorktree} can be exercised without a running Herdr session.
 *
 * @param worktrees The worktrees `listWorktrees` reports.
 * @param openWorkspaces The workspace ids open for a checkout path, keyed by path.
 * @returns The mocks standing in for each replaced function.
 */
async function mockCloseModules(
  worktrees: { branch: string; path: string; isMain: boolean }[],
  openWorkspaces: Record<string, string> = {},
) {
  const mocks = {
    runHerdr: mock(() => Promise.resolve("")),
    runHerdrJson: mock(() =>
      Promise.resolve({
        result: {
          workspaces: Object.entries(openWorkspaces).map(([path, workspaceId]) => ({
            workspace_id: workspaceId,
            worktree: { checkout_path: path },
          })),
        },
      }),
    ),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
  };

  await stubModule(import.meta.resolve("./herdr.ts"), () => ({
    runHerdr: mocks.runHerdr,
    runHerdrJson: mocks.runHerdrJson,
  }));
  await stubModule(import.meta.resolve("./worktrees.ts"), () => ({
    listWorktrees: mocks.listWorktrees,
  }));

  return mocks;
}

describe("closeProjectMain", () => {
  describe("when the main worktree has an open workspace", () => {
    it("closes it", async () => {
      const mocks = await mockCloseModules([{ branch: "main", path: "/tmp/orc", isMain: true }], {
        "/tmp/orc": "w1",
      });

      await closeProjectMain(PROJECT);

      expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w1"]);
    });
  });

  describe("when the repository has no main worktree", () => {
    it("throws", async () => {
      await mockCloseModules([]);

      const thrown = await closeProjectMain(PROJECT).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("no main worktree");
    });
  });

  describe("when the main worktree has no open workspace", () => {
    it("throws", async () => {
      await mockCloseModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

      const thrown = await closeProjectMain(PROJECT).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("no open workspace");
    });
  });
});

describe("closeProjectWorktree", () => {
  describe("when the branch's worktree has an open workspace", () => {
    it("removes it", async () => {
      const mocks = await mockCloseModules(
        [{ branch: "feature", path: "/tmp/worktrees/feature", isMain: false }],
        { "/tmp/worktrees/feature": "w2" },
      );

      await closeProjectWorktree(PROJECT, "feature");

      expect(mocks.runHerdr).toHaveBeenCalledWith(["worktree", "remove", "--workspace", "w2"]);
    });
  });

  describe("when the branch has no worktree", () => {
    it("throws", async () => {
      await mockCloseModules([]);

      const thrown = await closeProjectWorktree(PROJECT, "feature").catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain('no worktree on "feature"');
    });
  });

  describe("when the branch's worktree has no open workspace", () => {
    it("throws", async () => {
      await mockCloseModules([
        { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
      ]);

      const thrown = await closeProjectWorktree(PROJECT, "feature").catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("no open workspace");
    });
  });
});

describe("parseOpenWorktrees", () => {
  describe("when workspaces are backed by worktrees", () => {
    it("returns their repository roots and checkout paths", () => {
      const response = {
        result: {
          workspaces: [
            { worktree: { repo_root: "/tmp/orc", checkout_path: "/tmp/orc" } },
            {
              worktree: { repo_root: "/tmp/orc", checkout_path: "/tmp/worktrees/feature" },
            },
          ],
        },
      };

      expect(parseOpenWorktrees(response)).toEqual([
        { repositoryRoot: "/tmp/orc", checkoutPath: "/tmp/orc" },
        { repositoryRoot: "/tmp/orc", checkoutPath: "/tmp/worktrees/feature" },
      ]);
    });
  });

  describe("when a workspace has no worktree", () => {
    it("skips it", () => {
      const response = { result: { workspaces: [{ worktree: null }, { label: "plain" }] } };

      expect(parseOpenWorktrees(response)).toEqual([]);
    });
  });

  describe("when the response is not a workspace listing", () => {
    it("returns an empty list", () => {
      expect(parseOpenWorktrees({ nonsense: true })).toEqual([]);
    });
  });
});

describe("listProjectRows", () => {
  /**
   * Replaces the projects, worktrees, and herdr modules so {@link listProjectRows} can be exercised
   * without a running Herdr session.
   *
   * @param projects The projects `listProjects` reports.
   * @param openWorktrees The open workspaces `workspace list` reports, as repository root and
   *   checkout path pairs.
   * @param worktrees The worktrees `listWorktrees` reports, keyed by repository root.
   */
  async function mockListModules(
    projects: Project[],
    openWorktrees: { repositoryRoot: string; checkoutPath: string }[],
    worktrees: Record<string, { branch: string; path: string; isMain: boolean }[]> = {},
  ) {
    await stubModule(import.meta.resolve("./projects.ts"), () => ({
      listProjects: mock(() => Promise.resolve(projects)),
    }));
    await stubModule(import.meta.resolve("./herdr.ts"), () => ({
      runHerdrJson: mock(() =>
        Promise.resolve({
          result: {
            workspaces: openWorktrees.map(({ repositoryRoot, checkoutPath }) => ({
              worktree: { repo_root: repositoryRoot, checkout_path: checkoutPath },
            })),
          },
        }),
      ),
    }));
    await stubModule(import.meta.resolve("./worktrees.ts"), () => ({
      listWorktrees: mock((repositoryRoot: string) =>
        Promise.resolve(worktrees[repositoryRoot] ?? []),
      ),
    }));
  }

  describe("when a project has no open worktree", () => {
    it("reports a single row with nothing open", async () => {
      await mockListModules([PROJECT], []);

      expect(await listProjectRows()).toEqual([{ name: "orc", worktree: null, path: null }]);
    });
  });

  describe("when a project has one open worktree", () => {
    it("reports its branch and path", async () => {
      await mockListModules([PROJECT], [{ repositoryRoot: "/tmp/orc", checkoutPath: "/tmp/orc" }], {
        "/tmp/orc": [{ branch: "main", path: "/tmp/orc", isMain: true }],
      });

      expect(await listProjectRows()).toEqual([
        { name: "orc", worktree: "main", path: "/tmp/orc" },
      ]);
    });
  });

  describe("when a project has multiple open worktrees", () => {
    it("reports one row per open worktree", async () => {
      await mockListModules(
        [PROJECT],
        [
          { repositoryRoot: "/tmp/orc", checkoutPath: "/tmp/orc" },
          { repositoryRoot: "/tmp/orc", checkoutPath: "/tmp/worktrees/feature" },
        ],
        {
          "/tmp/orc": [
            { branch: "main", path: "/tmp/orc", isMain: true },
            { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
          ],
        },
      );

      expect(await listProjectRows()).toEqual([
        { name: "orc", worktree: "main", path: "/tmp/orc" },
        { name: "orc", worktree: "feature", path: "/tmp/worktrees/feature" },
      ]);
    });
  });
});

describe("workspaceRepositoryRoot", () => {
  describe("when the workspace has a worktree", () => {
    it("returns its repository root", async () => {
      await stubModule(import.meta.resolve("./herdr.ts"), () => ({
        runHerdrJson: mock(() =>
          Promise.resolve({
            result: { workspace: { worktree: { repo_root: "/home/user/Notes" } } },
          }),
        ),
      }));

      expect(await workspaceRepositoryRoot("w1")).toEqual("/home/user/Notes");
    });
  });

  describe("when the workspace has no worktree", () => {
    it("returns null", async () => {
      await stubModule(import.meta.resolve("./herdr.ts"), () => ({
        runHerdrJson: mock(() => Promise.resolve({ result: { workspace: {} } })),
      }));

      expect(await workspaceRepositoryRoot("w1")).toBeNull();
    });
  });
});
