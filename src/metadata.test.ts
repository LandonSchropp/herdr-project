import { stubModule } from "../test/helpers/module.ts";
import { reportOpenWorkspaceProjects, reportProject, reportWorkspaceProject } from "./metadata.ts";
import type { OpenWorkspace, Project } from "./types.ts";
import { describe, expect, it, mock } from "bun:test";

/**
 * Builds an open workspace with the fields the metadata helpers read.
 *
 * @param workspaceId The workspace's id.
 * @param repositoryRoot The absolute path to the repository the workspace is showing.
 * @param isManagedWorktree Whether Herdr tracks the workspace as one of its own worktrees.
 * @returns The open workspace.
 */
function openWorkspace(
  workspaceId: string,
  repositoryRoot: string,
  isManagedWorktree = true,
): OpenWorkspace {
  return {
    workspaceId,
    label: null,
    checkoutPath: repositoryRoot,
    repositoryRoot,
    isManagedWorktree,
  };
}

// `wI` is flat rather than a worktree Herdr manages, and is the workspace the assertions below
// report against: a flat workspace has to reach the same project name as any other.
const WORKSPACES = [
  openWorkspace("wG", "/home/user/Notes"),
  openWorkspace("wH", "/home/user/Development/herdr-project"),
  openWorkspace("wI", "/home/user/.dotfiles", false),
];

/**
 * Builds a project with the defaults the metadata helpers ignore.
 *
 * @param name The project's display name.
 * @param repositoryRoot The absolute path to the project's repository.
 * @returns The project.
 */
function project(name: string, repositoryRoot: string): Project {
  return { name, repositoryRoot, tabs: [], focusedTab: null, prompt: null };
}

// The `.dotfiles` repository is declared as `dotfiles`, which is what separates a project's name
// from its directory.
const PROJECTS = [
  project("Notes", "/home/user/Notes"),
  project("herdr-project", "/home/user/Development/herdr-project"),
  project("dotfiles", "/home/user/.dotfiles"),
];

/**
 * Replaces the herdr, open-workspace, and project modules so the metadata helpers can be exercised
 * without a running Herdr session.
 *
 * @param workspaces The workspaces `listOpenWorkspaces` reports.
 * @param projects The projects `listProjects` reports.
 * @returns The mocks standing in for each replaced function.
 */
async function mockModules(
  workspaces: OpenWorkspace[] = WORKSPACES,
  projects: Project[] = PROJECTS,
) {
  const mocks = {
    runHerdr: mock(() => Promise.resolve("")),
    listOpenWorkspaces: mock(() => Promise.resolve(workspaces)),
    listProjects: mock(() => Promise.resolve(projects)),
  };

  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdr: mocks.runHerdr }));
  await stubModule(import.meta.resolve("./open-workspaces.ts"), () => ({
    listOpenWorkspaces: mocks.listOpenWorkspaces,
  }));
  await stubModule(import.meta.resolve("./projects.ts"), () => ({
    listProjects: mocks.listProjects,
  }));

  return mocks;
}

describe("reportProject", () => {
  it("reports the name as the project token", async () => {
    const mocks = await mockModules();

    await reportProject("wI", "dotfiles");

    expect(mocks.runHerdr).toHaveBeenCalledWith([
      "workspace",
      "report-metadata",
      "wI",
      "--source",
      "landonschropp.herdr-project",
      "--token",
      "project=dotfiles",
    ]);
  });

  it("reads no workspaces, since the caller already knows the name", async () => {
    const mocks = await mockModules();

    await reportProject("wI", "dotfiles");

    expect(mocks.listOpenWorkspaces).not.toHaveBeenCalled();
  });

  describe("when Herdr refuses the report", () => {
    it("returns the failure rather than throwing", async () => {
      const mocks = await mockModules();
      mocks.runHerdr.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportProject("wI", "dotfiles")).toContain("herdr is not listening");
    });
  });
});

describe("reportWorkspaceProject", () => {
  describe("when the workspace's repository is a configured project", () => {
    it("reports the project's name rather than its directory", async () => {
      const mocks = await mockModules();

      await reportWorkspaceProject("wI");

      expect(mocks.runHerdr).toHaveBeenCalledWith([
        "workspace",
        "report-metadata",
        "wI",
        "--source",
        "landonschropp.herdr-project",
        "--token",
        "project=dotfiles",
      ]);
    });

    it("returns a message naming the project", async () => {
      await mockModules();

      expect(await reportWorkspaceProject("wI")).toContain("dotfiles");
    });
  });

  describe("when the workspace's repository is not a configured project", () => {
    it("reports nothing", async () => {
      const mocks = await mockModules(WORKSPACES, [project("Notes", "/home/user/Notes")]);

      await reportWorkspaceProject("wI");

      expect(mocks.runHerdr).not.toHaveBeenCalled();
    });
  });

  describe("when no workspace has the id", () => {
    it("reports nothing", async () => {
      const mocks = await mockModules();

      await reportWorkspaceProject("wZ");

      expect(mocks.runHerdr).not.toHaveBeenCalled();
    });
  });

  describe("when Herdr will not list its workspaces", () => {
    it("returns the failure rather than throwing", async () => {
      const mocks = await mockModules();
      mocks.listOpenWorkspaces.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportWorkspaceProject("wI")).toContain("herdr is not listening");
    });
  });
});

describe("reportOpenWorkspaceProjects", () => {
  describe("when workspaces are open", () => {
    it("reports one project name per workspace", async () => {
      const mocks = await mockModules();

      await reportOpenWorkspaceProjects();

      expect(mocks.runHerdr).toHaveBeenCalledTimes(3);
    });

    it("reports each workspace's own project name", async () => {
      const mocks = await mockModules();

      await reportOpenWorkspaceProjects();

      expect(mocks.runHerdr).toHaveBeenCalledWith([
        "workspace",
        "report-metadata",
        "wI",
        "--source",
        "landonschropp.herdr-project",
        "--token",
        "project=dotfiles",
      ]);
    });

    it("returns a message counting them", async () => {
      await mockModules();

      expect(await reportOpenWorkspaceProjects()).toContain("3");
    });
  });

  describe("when no workspace's repository is a configured project", () => {
    it("reports nothing", async () => {
      const mocks = await mockModules(WORKSPACES, []);

      await reportOpenWorkspaceProjects();

      expect(mocks.runHerdr).not.toHaveBeenCalled();
    });
  });

  describe("when Herdr refuses a report", () => {
    it("returns the failure rather than counting it as reported", async () => {
      const mocks = await mockModules();
      mocks.runHerdr.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportOpenWorkspaceProjects()).toContain("herdr is not listening");
    });
  });

  describe("when Herdr will not list its workspaces", () => {
    it("returns the failure rather than throwing", async () => {
      const mocks = await mockModules();
      mocks.listOpenWorkspaces.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportOpenWorkspaceProjects()).toContain("herdr is not listening");
    });
  });
});
