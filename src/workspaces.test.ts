import { stubModule } from "../test/helpers/module.ts";
import type { Project } from "./types.ts";
import {
  createProjectWorktree,
  openProjectMain,
  openProjectWorktree,
  parseOpenCheckoutPaths,
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
