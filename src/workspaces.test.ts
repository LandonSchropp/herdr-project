import { stubModule } from "../test/helpers/module.ts";
import type { Project } from "./types.ts";
import {
  closeProjectMain,
  closeProjectWorktree,
  createProjectWorktree,
  openProjectMain,
  openProjectWorktree,
  parseOpenCheckoutPaths,
  parseOpenWorkspaceId,
  workspaceRepositoryRoot,
} from "./workspaces.ts";
import { describe, expect, it, mock } from "bun:test";

const TABS = [{ name: "shell", command: null }];

const PROJECT: Project = {
  name: "orc",
  repositoryRoot: "/tmp/orc",
  tabs: TABS,
  focusedTab: null,
  prompt: null,
};

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
    promptWorkspaceAgent: mock(() => Promise.resolve()),
    reportProject: mock(() => Promise.resolve("")),
    openWorktree: mock(() => Promise.resolve(WORKSPACE)),
    createWorktree: mock(() => Promise.resolve(CREATED_WORKSPACE)),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
    runHerdrJson: mock(() =>
      Promise.resolve({
        result: { workspaces: openPaths.map((path) => ({ worktree: { checkout_path: path } })) },
      }),
    ),
  };

  await stubModule(import.meta.resolve("./layout.ts"), () => ({ applyLayout: mocks.applyLayout }));
  await stubModule(import.meta.resolve("./agents.ts"), () => ({
    promptWorkspaceAgent: mocks.promptWorkspaceAgent,
  }));
  await stubModule(import.meta.resolve("./metadata.ts"), () => ({
    reportProject: mocks.reportProject,
  }));
  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdrJson: mocks.runHerdrJson }));
  await stubModule(import.meta.resolve("./worktrees.ts"), () => ({
    openWorktree: mocks.openWorktree,
    createWorktree: mocks.createWorktree,
    listWorktrees: mocks.listWorktrees,
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
      true,
    );
    expect(mocks.applyLayout).not.toHaveBeenCalled();
  });

  it("leaves the workspace's agent unprompted", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

    expect(mocks.promptWorkspaceAgent).not.toHaveBeenCalled();
  });

  it("reports the workspace's project name", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

    expect(mocks.reportProject).toHaveBeenCalledWith("wG", "orc");
  });

  describe("when the project declares a prompt", () => {
    it("prompts the workspace's agent", async () => {
      const mocks = await mockHerdrModules([]);

      await openProjectWorktree(
        { ...PROJECT, prompt: "read the README" },
        "/tmp/worktrees/feature",
      );

      expect(mocks.promptWorkspaceAgent).toHaveBeenCalledWith("wG", "read the README");
    });
  });

  describe("when focus is disabled", () => {
    it("opens the worktree in the background", async () => {
      const mocks = await mockHerdrModules([]);

      await openProjectWorktree(PROJECT, "/tmp/worktrees/feature", undefined, false);

      expect(mocks.openWorktree).toHaveBeenCalledWith(
        "/tmp/orc",
        "/tmp/worktrees/feature",
        undefined,
        false,
      );
    });
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

    expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", true);
    expect(mocks.applyLayout).not.toHaveBeenCalled();
  });

  it("reports the new workspace's project name", async () => {
    const mocks = await mockHerdrModules([]);

    await createProjectWorktree(PROJECT, "feature");

    expect(mocks.reportProject).toHaveBeenCalledWith("wG", "orc");
  });

  describe("when the project declares a prompt", () => {
    it("prompts the new workspace's agent", async () => {
      const mocks = await mockHerdrModules([]);

      await createProjectWorktree({ ...PROJECT, prompt: "read the README" }, "feature");

      expect(mocks.promptWorkspaceAgent).toHaveBeenCalledWith("wG", "read the README");
    });
  });

  describe("when focus is disabled", () => {
    it("creates the worktree in the background", async () => {
      const mocks = await mockHerdrModules([]);

      await createProjectWorktree(PROJECT, "feature", false);

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", false);
    });
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
        true,
      );
    });

    describe("when focus is disabled", () => {
      it("opens it in the background", async () => {
        const mocks = await mockHerdrModules([
          { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
        ]);

        await createProjectWorktree(PROJECT, "feature", false);

        expect(mocks.openWorktree).toHaveBeenCalledWith(
          "/tmp/orc",
          "/tmp/worktrees/feature",
          undefined,
          false,
        );
      });
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

describe("openProjectMain", () => {
  describe("when the repository has a main worktree", () => {
    it("opens it, naming the workspace after the project", async () => {
      const mocks = await mockHerdrModules([
        { branch: "feature", path: "/tmp/feature", isMain: false },
        { branch: "main", path: "/tmp/orc", isMain: true },
      ]);

      await openProjectMain(PROJECT);

      expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "orc", true);
    });

    describe("when focus is disabled", () => {
      it("opens it in the background", async () => {
        const mocks = await mockHerdrModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

        await openProjectMain(PROJECT, false);

        expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "orc", false);
      });
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
