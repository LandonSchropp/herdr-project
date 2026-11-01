import { stubModule } from "../test/helpers/module.ts";
import type { Project } from "./types.ts";
import {
  closeProjectMain,
  closeProjectWorktree,
  createProjectWorktree,
  openProject,
  openProjectMain,
  openProjectWorktree,
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
 * Builds a `runHerdrJson` mock that answers `workspace list` with the given workspaces and `pane
 * list` with the given panes, which is what the open-workspace listing reads.
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

/**
 * Replaces the herdr, worktree, and layout modules so the workspace helpers can be exercised
 * without a running Herdr session.
 *
 * @param worktrees The worktrees `listWorktrees` reports.
 * @param openPaths The checkout paths that already have a workspace open, each optionally paired
 *   with the workspace's label.
 * @param flat Whether the settings ask for flat workspaces.
 * @returns The mocks standing in for each replaced function.
 */
async function mockHerdrModules(
  worktrees: { branch: string; path: string; isMain: boolean; isBare?: boolean }[],
  openPaths: (string | { path: string; label: string })[] = [],
  flat = false,
) {
  const mocks = {
    applyLayout: mock(() => Promise.resolve()),
    promptWorkspaceAgent: mock(() => Promise.resolve()),
    reportProject: mock(() => Promise.resolve("")),
    openWorktree: mock(() => Promise.resolve(WORKSPACE)),
    createWorktree: mock(() => Promise.resolve(CREATED_WORKSPACE)),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
    openFlatWorkspace: mock(() => Promise.resolve(WORKSPACE)),
    createFlatWorktree: mock(() => Promise.resolve(CREATED_WORKSPACE)),
    loadSettings: mock(() => Promise.resolve({ flat })),
    mainCheckoutPath: mock((): Promise<string | null> => Promise.resolve(PROJECT.repositoryRoot)),
    runHerdrJson: mockRunHerdrJson(
      openPaths.map((entry, index) => {
        const { path, label } = typeof entry === "string" ? { path: entry, label: null } : entry;

        return {
          workspace_id: `w${index}`,
          label,
          worktree: { checkout_path: path, repo_root: PROJECT.repositoryRoot },
        };
      }),
    ),
  };

  await stubModule(import.meta.resolve("./git.ts"), () => ({
    mainCheckoutPath: mocks.mainCheckoutPath,
  }));
  await stubModule(import.meta.resolve("./layout.ts"), () => ({ applyLayout: mocks.applyLayout }));
  await stubModule(import.meta.resolve("./agents.ts"), () => ({
    promptWorkspaceAgent: mocks.promptWorkspaceAgent,
  }));
  await stubModule(import.meta.resolve("./metadata.ts"), () => ({
    reportProject: mocks.reportProject,
  }));
  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdrJson: mocks.runHerdrJson }));
  await stubModule(import.meta.resolve("./settings.ts"), () => ({
    loadSettings: mocks.loadSettings,
  }));
  await stubModule(import.meta.resolve("./worktrees.ts"), () => ({
    openWorktree: mocks.openWorktree,
    createWorktree: mocks.createWorktree,
    listWorktrees: mocks.listWorktrees,
    openFlatWorkspace: mocks.openFlatWorkspace,
    createFlatWorktree: mocks.createFlatWorktree,
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

  describe("when the settings ask for flat workspaces", () => {
    it("opens the checkout as its own workspace named after its directory", async () => {
      const mocks = await mockHerdrModules([], [], true);

      await openProjectWorktree(PROJECT, "/tmp/worktrees/feature");

      expect(mocks.openFlatWorkspace).toHaveBeenCalledWith(
        "/tmp/worktrees/feature",
        "feature",
        true,
      );
      expect(mocks.openWorktree).not.toHaveBeenCalled();
    });

    describe("when a label is given", () => {
      it("names the workspace after the label", async () => {
        const mocks = await mockHerdrModules([], [], true);

        await openProjectWorktree(PROJECT, "/tmp/worktrees/feature", "fix-sync");

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith(
          "/tmp/worktrees/feature",
          "fix-sync",
          true,
        );
      });
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
  describe("when the project is outside any repository", () => {
    it("throws without creating anything", async () => {
      const mocks = await mockHerdrModules([]);
      mocks.mainCheckoutPath.mockResolvedValue(null);

      const thrown = await createProjectWorktree(PROJECT, "feature").catch((error: Error) => error);

      expect((thrown as Error).message).toContain("not in a Git repository");
      expect(mocks.createWorktree).not.toHaveBeenCalled();
    });
  });

  it("creates the worktree and leaves the tabs to the workspace.created hook", async () => {
    const mocks = await mockHerdrModules([]);

    await createProjectWorktree(PROJECT, "feature");

    expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", undefined, true);
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

      await createProjectWorktree(PROJECT, "feature", undefined, false);

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", undefined, false);
    });
  });

  describe("when a label is given", () => {
    it("passes it through instead of leaving the workspace named after the branch", async () => {
      const mocks = await mockHerdrModules([]);

      await createProjectWorktree(PROJECT, "feature", "fix-sync");

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", "fix-sync", true);
    });
  });

  describe("when the settings ask for flat workspaces", () => {
    it("creates the worktree with Git rather than with Herdr", async () => {
      const mocks = await mockHerdrModules([], [], true);

      await createProjectWorktree(PROJECT, "feature");

      expect(mocks.createFlatWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", undefined, true);
      expect(mocks.createWorktree).not.toHaveBeenCalled();
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

    describe("when a label is given", () => {
      it("passes it through as the workspace's label", async () => {
        const mocks = await mockHerdrModules([
          { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
        ]);

        await createProjectWorktree(PROJECT, "feature", "fix-sync");

        expect(mocks.openWorktree).toHaveBeenCalledWith(
          "/tmp/orc",
          "/tmp/worktrees/feature",
          "fix-sync",
          true,
        );
      });
    });

    describe("when focus is disabled", () => {
      it("opens it in the background", async () => {
        const mocks = await mockHerdrModules([
          { branch: "feature", path: "/tmp/worktrees/feature", isMain: false },
        ]);

        await createProjectWorktree(PROJECT, "feature", undefined, false);

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

        await openProjectMain(PROJECT, undefined, false);

        expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "orc", false);
      });
    });

    describe("when a label is given", () => {
      it("names the workspace with it instead of the project", async () => {
        const mocks = await mockHerdrModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

        await openProjectMain(PROJECT, "fix-sync");

        expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "fix-sync", true);
      });
    });

    describe("when a workspace with the same label is already open on it", () => {
      it("refuses rather than opening a second one", async () => {
        const mocks = await mockHerdrModules(
          [{ branch: "main", path: "/tmp/orc", isMain: true }],
          [{ path: "/tmp/orc", label: "orc" }],
        );

        const thrown = await openProjectMain(PROJECT).catch((error: Error) => error);

        expect((thrown as Error).message).toContain("already open");
        expect(mocks.openFlatWorkspace).not.toHaveBeenCalled();
      });
    });

    describe("when the settings ask for flat workspaces", () => {
      it("opens it as a plain workspace", async () => {
        const mocks = await mockHerdrModules(
          [{ branch: "main", path: "/tmp/orc", isMain: true }],
          [],
          true,
        );

        await openProjectMain(PROJECT);

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "orc", true);
      });
    });

    describe("when a workspace with another label is already open on it", () => {
      it("opens another one as a plain workspace", async () => {
        const mocks = await mockHerdrModules(
          [{ branch: "main", path: "/tmp/orc", isMain: true }],
          [{ path: "/tmp/orc", label: "orc" }],
        );

        await openProjectMain(PROJECT, "plan-day");

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "plan-day", true);
        expect(mocks.openWorktree).not.toHaveBeenCalled();
      });

      it("prompts the new workspace's agent", async () => {
        const mocks = await mockHerdrModules(
          [{ branch: "main", path: "/tmp/orc", isMain: true }],
          [{ path: "/tmp/orc", label: "orc" }],
        );

        await openProjectMain({ ...PROJECT, prompt: "/plan-day" }, "plan-day");

        expect(mocks.promptWorkspaceAgent).toHaveBeenCalledWith("wG", "/plan-day");
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

  describe("when the project is outside any repository", () => {
    it("opens its directory as a plain workspace, naming it after the project", async () => {
      const mocks = await mockHerdrModules([]);
      mocks.mainCheckoutPath.mockResolvedValue(null);

      await openProjectMain(PROJECT);

      expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "orc", true);
    });

    describe("when a label is given", () => {
      it("names the workspace with it instead of the project", async () => {
        const mocks = await mockHerdrModules([]);
        mocks.mainCheckoutPath.mockResolvedValue(null);

        await openProjectMain(PROJECT, "fix-sync", false);

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "fix-sync", false);
      });
    });

    describe("when a workspace with the same label is already open on the directory", () => {
      it("refuses rather than laying a second set of tabs into it", async () => {
        const mocks = await mockHerdrModules([], [{ path: "/tmp/orc", label: "orc" }]);
        mocks.mainCheckoutPath.mockResolvedValue(null);

        const thrown = await openProjectMain(PROJECT).catch((error: Error) => error);

        expect((thrown as Error).message).toContain("already open");
        expect(mocks.openFlatWorkspace).not.toHaveBeenCalled();
      });
    });

    describe("when a workspace with another label is already open on the directory", () => {
      it("opens another one", async () => {
        const mocks = await mockHerdrModules([], [{ path: "/tmp/orc", label: "orc" }]);
        mocks.mainCheckoutPath.mockResolvedValue(null);

        await openProjectMain(PROJECT, "plan-day");

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "plan-day", true);
      });
    });
  });

  describe("when the main worktree is bare", () => {
    it("opens it as a plain workspace, naming it after the project", async () => {
      const mocks = await mockHerdrModules([
        { branch: "", path: "/tmp/orc", isMain: true, isBare: true },
      ]);

      await openProjectMain(PROJECT);

      expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "orc", true);
      expect(mocks.openWorktree).not.toHaveBeenCalled();
    });

    describe("when a label is given", () => {
      it("names the workspace with it instead of the project", async () => {
        const mocks = await mockHerdrModules([
          { branch: "", path: "/tmp/orc", isMain: true, isBare: true },
        ]);

        await openProjectMain(PROJECT, "fix-sync");

        expect(mocks.openFlatWorkspace).toHaveBeenCalledWith("/tmp/orc", "fix-sync", true);
      });
    });

    describe("when a workspace with the same label is already open on it", () => {
      it("refuses rather than laying a second set of tabs into it", async () => {
        const mocks = await mockHerdrModules(
          [{ branch: "", path: "/tmp/orc", isMain: true, isBare: true }],
          [{ path: "/tmp/orc", label: "orc" }],
        );

        const thrown = await openProjectMain(PROJECT).catch((error: Error) => error);

        expect(thrown).toBeInstanceOf(Error);
        expect((thrown as Error).message).toContain("already open");
        expect(mocks.openFlatWorkspace).not.toHaveBeenCalled();
      });
    });
  });
});

/**
 * Replaces the herdr and worktree modules so {@link closeProjectMain} and
 * {@link closeProjectWorktree} can be exercised without a running Herdr session.
 *
 * @param worktrees The worktrees `listWorktrees` reports.
 * @param openWorkspaces The checkout path each open workspace is showing, optionally paired with
 *   the workspace's label, keyed by workspace id.
 * @param flat Whether the open workspaces are flat rather than worktrees Herdr manages.
 * @returns The mocks standing in for each replaced function.
 */
async function mockCloseModules(
  worktrees: { branch: string; path: string; isMain: boolean }[],
  openWorkspaces: Record<string, string | { path: string; label: string }> = {},
  flat = false,
) {
  const entries = Object.entries(openWorkspaces).map(([workspaceId, entry]) =>
    typeof entry === "string"
      ? { workspaceId, path: entry, label: null }
      : { workspaceId, ...entry },
  );

  const mocks = {
    runHerdr: mock(() => Promise.resolve("")),
    removeWorktree: mock(() => Promise.resolve()),
    // A flat workspace carries no worktree, so Herdr reports only its pane's directory.
    runHerdrJson: flat
      ? mockRunHerdrJson(
          entries.map(({ workspaceId, label }) => ({ workspace_id: workspaceId, label })),
          entries.map(({ workspaceId, path }) => ({ workspace_id: workspaceId, cwd: path })),
        )
      : mockRunHerdrJson(
          entries.map(({ workspaceId, path, label }) => ({
            workspace_id: workspaceId,
            label,
            worktree: { checkout_path: path, repo_root: PROJECT.repositoryRoot },
          })),
        ),
    listWorktrees: mock(() => Promise.resolve(worktrees)),
    mainCheckoutPath: mock((): Promise<string | null> => Promise.resolve(PROJECT.repositoryRoot)),
  };

  await stubModule(import.meta.resolve("./git.ts"), () => ({
    mainCheckoutPath: mocks.mainCheckoutPath,
    removeWorktree: mocks.removeWorktree,
  }));
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
  describe("when the project is outside any repository", () => {
    it("closes the workspace open on its directory", async () => {
      const mocks = await mockCloseModules([], { w1: "/tmp/orc" }, true);
      mocks.mainCheckoutPath.mockResolvedValue(null);

      await closeProjectMain(PROJECT);

      expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w1"]);
    });

    describe("when its directory has no open workspace", () => {
      it("throws", async () => {
        const mocks = await mockCloseModules([]);
        mocks.mainCheckoutPath.mockResolvedValue(null);

        const thrown = await closeProjectMain(PROJECT).catch((error: Error) => error);

        expect((thrown as Error).message).toContain("no open workspace");
      });
    });
  });

  describe("when the main worktree has an open workspace", () => {
    it("closes it", async () => {
      const mocks = await mockCloseModules([{ branch: "main", path: "/tmp/orc", isMain: true }], {
        w1: "/tmp/orc",
      });

      await closeProjectMain(PROJECT);

      expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w1"]);
    });
  });

  describe("when the main worktree has several open workspaces", () => {
    const worktrees = [{ branch: "main", path: "/tmp/orc", isMain: true }];
    const openWorkspaces = {
      w1: { path: "/tmp/orc", label: "orc" },
      w2: { path: "/tmp/orc", label: "plan-day" },
    };

    describe("when a label is given", () => {
      it("closes the workspace with that label", async () => {
        const mocks = await mockCloseModules(worktrees, openWorkspaces);

        await closeProjectMain(PROJECT, "plan-day");

        expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w2"]);
      });
    });

    describe("when the label matches none of them", () => {
      it("throws", async () => {
        await mockCloseModules(worktrees, openWorkspaces);

        const thrown = await closeProjectMain(PROJECT, "other").catch((error: Error) => error);

        expect((thrown as Error).message).toContain("no open workspace");
      });
    });

    describe("when no label is given", () => {
      it("closes the one named after the project", async () => {
        const mocks = await mockCloseModules(worktrees, openWorkspaces);

        await closeProjectMain(PROJECT);

        expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w1"]);
      });

      describe("when none of them is named after the project", () => {
        it("throws without closing any of them", async () => {
          const mocks = await mockCloseModules(worktrees, {
            w1: { path: "/tmp/orc", label: "review" },
            w2: { path: "/tmp/orc", label: "plan-day" },
          });

          const thrown = await closeProjectMain(PROJECT).catch((error: Error) => error);

          expect((thrown as Error).message).toContain("several open workspaces");
          expect(mocks.runHerdr).not.toHaveBeenCalled();
        });
      });
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
        { w2: "/tmp/worktrees/feature" },
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

  describe("when the workspace is flat", () => {
    it("removes the checkout with Git, which Herdr will not do for it", async () => {
      const mocks = await mockCloseModules(
        [{ branch: "feature", path: "/tmp/worktrees/feature", isMain: false }],
        { w2: "/tmp/worktrees/feature" },
        true,
      );

      await closeProjectWorktree(PROJECT, "feature");

      expect(mocks.removeWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/worktrees/feature");
    });

    it("closes the workspace", async () => {
      const mocks = await mockCloseModules(
        [{ branch: "feature", path: "/tmp/worktrees/feature", isMain: false }],
        { w2: "/tmp/worktrees/feature" },
        true,
      );

      await closeProjectWorktree(PROJECT, "feature");

      expect(mocks.runHerdr).toHaveBeenCalledWith(["workspace", "close", "w2"]);
    });

    describe("when Git refuses to remove the checkout", () => {
      it("leaves the workspace open", async () => {
        const mocks = await mockCloseModules(
          [{ branch: "feature", path: "/tmp/worktrees/feature", isMain: false }],
          { w2: "/tmp/worktrees/feature" },
          true,
        );
        mocks.removeWorktree.mockRejectedValue(new Error("contains modified files"));

        const thrown = await closeProjectWorktree(PROJECT, "feature").catch(
          (error: Error) => error,
        );

        expect((thrown as Error).message).toContain("contains modified files");
        expect(mocks.runHerdr).not.toHaveBeenCalled();
      });
    });
  });
});

describe("openProject", () => {
  describe("when the branch is empty", () => {
    it("opens the project's main checkout", async () => {
      const mocks = await mockHerdrModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

      await openProject(PROJECT, "");

      expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "orc", true);
      expect(mocks.createWorktree).not.toHaveBeenCalled();
    });
  });

  describe("when the branch is named", () => {
    it("creates that worktree instead", async () => {
      const mocks = await mockHerdrModules([]);

      await openProject(PROJECT, "feature");

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", undefined, true);
    });
  });

  describe("when focus is disabled", () => {
    it("passes it along", async () => {
      const mocks = await mockHerdrModules([]);

      await openProject(PROJECT, "feature", undefined, false);

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", undefined, false);
    });
  });

  describe("when a label is given", () => {
    it("passes it along for the main checkout", async () => {
      const mocks = await mockHerdrModules([{ branch: "main", path: "/tmp/orc", isMain: true }]);

      await openProject(PROJECT, "", "fix-sync");

      expect(mocks.openWorktree).toHaveBeenCalledWith("/tmp/orc", "/tmp/orc", "fix-sync", true);
    });

    it("passes it along for a worktree", async () => {
      const mocks = await mockHerdrModules([]);

      await openProject(PROJECT, "feature", "fix-sync");

      expect(mocks.createWorktree).toHaveBeenCalledWith("/tmp/orc", "feature", "fix-sync", true);
    });
  });
});
