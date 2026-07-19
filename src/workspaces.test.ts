import type { Project } from "./types.ts";
import { createProjectWorktree, openProjectMain, openProjectWorktree } from "./workspaces.ts";
import { describe, expect, it, mock } from "bun:test";

const TABS = [{ name: "shell", command: null }];

const PROJECT: Project = { name: "orc", repositoryRoot: "/tmp/orc", tabs: TABS };

const WORKSPACE = { workspaceId: "wG", rootTabId: "wG:t1", rootPaneId: "wG:p1" };

/**
 * Replaces the worktree and layout modules so the workspace helpers can be exercised without a
 * running Herdr session.
 *
 * @param worktrees The worktrees `listWorktrees` reports.
 * @returns The mocks standing in for each replaced function.
 */
async function mockHerdrModules(worktrees: { branch: string; path: string; isMain: boolean }[]) {
  const mocks = {
    applyLayout: mock(() => Promise.resolve()),
    openWorktree: mock(() => Promise.resolve(WORKSPACE)),
    createWorktree: mock(() => Promise.resolve(WORKSPACE)),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
  };

  await mock.module("./layout.ts", () => ({ applyLayout: mocks.applyLayout }));
  await mock.module("./worktrees.ts", () => ({
    openWorktree: mocks.openWorktree,
    createWorktree: mocks.createWorktree,
    listWorktrees: mocks.listWorktrees,
  }));

  return mocks;
}

describe("openProjectWorktree", () => {
  it("opens the worktree and lays the project's tabs into its workspace", async () => {
    const mocks = await mockHerdrModules([]);

    await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

    expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/worktrees/feature");
    expect(mocks.applyLayout).toHaveBeenCalledWith(WORKSPACE, TABS);
  });
});

describe("createProjectWorktree", () => {
  it("creates the worktree and lays the project's tabs into its workspace", async () => {
    const mocks = await mockHerdrModules([]);

    await createProjectWorktree(PROJECT, "feature");

    expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature");
    expect(mocks.applyLayout).toHaveBeenCalledWith(WORKSPACE, TABS);
  });
});

describe("openProjectMain", () => {
  describe("when the repository has a main worktree", () => {
    it("opens it", async () => {
      const mocks = await mockHerdrModules([
        { branch: "feature", path: "/tmp/feature", isMain: false },
        { branch: "main", path: "/tmp/orc", isMain: true },
      ]);

      await openProjectMain(PROJECT);

      expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc");
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
