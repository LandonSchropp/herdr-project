import { stubModule } from "../test/helpers/module.ts";
import { mockSpawn } from "./herdr.test.ts";
import {
  createFlatWorktree,
  createWorktree,
  flatWorktreePath,
  listWorktrees,
  openFlatWorkspace,
  openWorktree,
  parseWorktrees,
  sortWorktrees,
} from "./worktrees.ts";
import { describe, expect, it, mock } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";

const RESPONSE = {
  id: "cli:worktree:list",
  result: {
    type: "worktree_list",
    worktrees: [
      {
        branch: "value-proposition",
        is_linked_worktree: true,
        path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
      },
      {
        branch: "main",
        is_linked_worktree: false,
        path: "/home/user/Development/orc",
      },
    ],
  },
};

const WORKSPACE_RESPONSE = JSON.stringify({
  result: {
    root_pane: { pane_id: "wG:p1" },
    tab: { tab_id: "wG:t1" },
    workspace: {
      workspace_id: "wG",
      worktree: { checkout_path: "/tmp/worktrees/feature" },
    },
  },
});

describe("parseWorktrees", () => {
  describe("when the response lists worktrees", () => {
    it("returns each worktree with its branch, path, and main flag", () => {
      expect(parseWorktrees(RESPONSE)).toEqual([
        {
          branch: "value-proposition",
          path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
          isMain: false,
          isBare: false,
        },
        {
          branch: "main",
          path: "/home/user/Development/orc",
          isMain: true,
          isBare: false,
        },
      ]);
    });
  });

  describe("when a worktree is detached with no branch", () => {
    it("skips it", () => {
      const response = {
        result: { worktrees: [{ is_linked_worktree: true, path: "/tmp/detached" }] },
      };

      expect(parseWorktrees(response)).toEqual([]);
    });
  });

  describe("when the main worktree is bare with no branch", () => {
    it("keeps it", () => {
      const response = {
        result: {
          worktrees: [{ is_linked_worktree: false, is_bare: true, path: "/tmp/anywhere" }],
        },
      };

      expect(parseWorktrees(response)).toEqual([
        { branch: "", path: "/tmp/anywhere", isMain: true, isBare: true },
      ]);
    });
  });

  describe("when the response has no worktrees", () => {
    it("returns an empty list", () => {
      expect(parseWorktrees({ result: { worktrees: [] } })).toEqual([]);
    });
  });

  describe("when the response is not shaped like a worktree list", () => {
    it("returns an empty list", () => {
      expect(parseWorktrees({ nonsense: true })).toEqual([]);
    });
  });
});

describe("sortWorktrees", () => {
  describe("when a main worktree is present", () => {
    it("puts the main worktree first and sorts the rest by branch", () => {
      const worktrees = [
        { branch: "zebra", path: "/tmp/zebra", isMain: false, isBare: false },
        { branch: "main", path: "/tmp/main", isMain: true, isBare: false },
        { branch: "apple", path: "/tmp/apple", isMain: false, isBare: false },
      ];

      expect(sortWorktrees(worktrees).map((worktree) => worktree.branch)).toEqual([
        "main",
        "apple",
        "zebra",
      ]);
    });
  });

  describe("when there is no main worktree", () => {
    it("sorts every worktree by branch", () => {
      const worktrees = [
        { branch: "zebra", path: "/tmp/zebra", isMain: false, isBare: false },
        { branch: "apple", path: "/tmp/apple", isMain: false, isBare: false },
      ];

      expect(sortWorktrees(worktrees).map((worktree) => worktree.branch)).toEqual([
        "apple",
        "zebra",
      ]);
    });
  });
});

describe("listWorktrees", () => {
  it("returns the repository's worktrees with the main worktree first", async () => {
    const spawn = mockSpawn(JSON.stringify(RESPONSE));

    expect(await listWorktrees("/tmp/repo")).toEqual([
      { branch: "main", path: "/home/user/Development/orc", isMain: true, isBare: false },
      {
        branch: "value-proposition",
        path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
        isMain: false,
        isBare: false,
      },
    ]);

    expect(spawn).toHaveBeenCalledWith(
      ["herdr", "worktree", "list", "--cwd", "/tmp/repo", "--json"],
      expect.anything(),
    );
  });
});

describe("openWorktree", () => {
  it("opens the worktree at the given path and returns its workspace", async () => {
    const spawn = mockSpawn(WORKSPACE_RESPONSE);

    expect(await openWorktree("/tmp/repo", "/tmp/worktrees/feature")).toEqual({
      workspaceId: "wG",
      rootTabId: "wG:t1",
      rootPaneId: "wG:p1",
    });

    expect(spawn).toHaveBeenCalledWith(
      [
        "herdr",
        "worktree",
        "open",
        "--cwd",
        "/tmp/repo",
        "--path",
        "/tmp/worktrees/feature",
        "--focus",
        "--json",
      ],
      expect.anything(),
    );
  });

  describe("when focus is disabled", () => {
    it("opens the worktree in the background", async () => {
      const spawn = mockSpawn(WORKSPACE_RESPONSE);

      await openWorktree("/tmp/repo", "/tmp/worktrees/feature", undefined, false);

      expect(spawn).toHaveBeenCalledWith(
        [
          "herdr",
          "worktree",
          "open",
          "--cwd",
          "/tmp/repo",
          "--path",
          "/tmp/worktrees/feature",
          "--no-focus",
          "--json",
        ],
        expect.anything(),
      );
    });
  });
});

describe("createWorktree", () => {
  it("creates the worktree on the given branch and returns its workspace and checkout path", async () => {
    const spawn = mockSpawn(WORKSPACE_RESPONSE);

    expect(await createWorktree("/tmp/repo", "feature")).toEqual({
      workspaceId: "wG",
      rootTabId: "wG:t1",
      rootPaneId: "wG:p1",
      checkoutPath: "/tmp/worktrees/feature",
    });

    expect(spawn).toHaveBeenCalledWith(
      [
        "herdr",
        "worktree",
        "create",
        "--cwd",
        "/tmp/repo",
        "--branch",
        "feature",
        "--focus",
        "--json",
      ],
      expect.anything(),
    );
  });

  describe("when focus is disabled", () => {
    it("creates the worktree in the background", async () => {
      const spawn = mockSpawn(WORKSPACE_RESPONSE);

      await createWorktree("/tmp/repo", "feature", false);

      expect(spawn).toHaveBeenCalledWith(
        [
          "herdr",
          "worktree",
          "create",
          "--cwd",
          "/tmp/repo",
          "--branch",
          "feature",
          "--no-focus",
          "--json",
        ],
        expect.anything(),
      );
    });
  });

  describe("when the response reports no checkout path", () => {
    it("throws", async () => {
      mockSpawn(
        JSON.stringify({
          result: {
            root_pane: { pane_id: "wG:p1" },
            tab: { tab_id: "wG:t1" },
            workspace: { workspace_id: "wG" },
          },
        }),
      );

      const thrown = await createWorktree("/tmp/repo", "feature").catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("did not report a checkout path");
    });
  });
});

describe("flatWorktreePath", () => {
  it("puts the checkout where Herdr puts its own", () => {
    expect(flatWorktreePath("/home/user/Development/orc", "feature")).toEqual(
      join(homedir(), ".herdr/worktrees/orc/feature"),
    );
  });
});

describe("openFlatWorkspace", () => {
  it("creates a workspace on the checkout rather than a worktree Herdr manages", async () => {
    const spawn = mockSpawn(WORKSPACE_RESPONSE);

    expect(await openFlatWorkspace("/tmp/worktrees/feature", "feature")).toEqual({
      workspaceId: "wG",
      rootTabId: "wG:t1",
      rootPaneId: "wG:p1",
    });

    expect(spawn).toHaveBeenCalledWith(
      [
        "herdr",
        "workspace",
        "create",
        "--cwd",
        "/tmp/worktrees/feature",
        "--label",
        "feature",
        "--focus",
      ],
      expect.anything(),
    );
  });

  describe("when focus is disabled", () => {
    it("opens the workspace in the background", async () => {
      const spawn = mockSpawn(WORKSPACE_RESPONSE);

      await openFlatWorkspace("/tmp/worktrees/feature", "feature", false);

      expect(spawn).toHaveBeenCalledWith(
        [
          "herdr",
          "workspace",
          "create",
          "--cwd",
          "/tmp/worktrees/feature",
          "--label",
          "feature",
          "--no-focus",
        ],
        expect.anything(),
      );
    });
  });
});

describe("createFlatWorktree", () => {
  /**
   * Replaces the Git and include modules so the checkout is never really created.
   *
   * @returns The mocks standing in for each replaced function.
   */
  async function mockCreateModules() {
    const mocks = {
      addWorktree: mock(() => Promise.resolve()),
      copyIncludedPaths: mock(() => Promise.resolve([])),
    };

    await stubModule(import.meta.resolve("./git.ts"), () => ({ addWorktree: mocks.addWorktree }));
    await stubModule(import.meta.resolve("./worktree-include.ts"), () => ({
      copyIncludedPaths: mocks.copyIncludedPaths,
    }));

    return mocks;
  }

  it("creates the checkout with Git", async () => {
    const mocks = await mockCreateModules();
    mockSpawn(WORKSPACE_RESPONSE);

    await createFlatWorktree("/tmp/repo", "feature");

    expect(mocks.addWorktree).toHaveBeenCalledWith(
      "/tmp/repo",
      "feature",
      join(homedir(), ".herdr/worktrees/repo/feature"),
    );
  });

  it("copies the repository's include files, which Herdr's own hook never fires for", async () => {
    const mocks = await mockCreateModules();
    mockSpawn(WORKSPACE_RESPONSE);

    await createFlatWorktree("/tmp/repo", "feature");

    expect(mocks.copyIncludedPaths).toHaveBeenCalledWith(
      "/tmp/repo",
      join(homedir(), ".herdr/worktrees/repo/feature"),
    );
  });

  it("returns the workspace and the checkout it was created at", async () => {
    await mockCreateModules();
    mockSpawn(WORKSPACE_RESPONSE);

    expect(await createFlatWorktree("/tmp/repo", "feature")).toEqual({
      workspaceId: "wG",
      rootTabId: "wG:t1",
      rootPaneId: "wG:p1",
      checkoutPath: join(homedir(), ".herdr/worktrees/repo/feature"),
    });
  });
});
