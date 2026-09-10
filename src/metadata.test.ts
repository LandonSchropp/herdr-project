import { stubModule } from "../test/helpers/module.ts";
import {
  parseRepositoryRoots,
  reportOpenWorkspaceProjects,
  reportProject,
  reportWorkspaceProject,
} from "./metadata.ts";
import type { Project } from "./types.ts";
import { describe, expect, it, mock } from "bun:test";

const WORKSPACES = {
  result: {
    workspaces: [
      { workspace_id: "wG", worktree: { repo_root: "/home/user/Notes" } },
      { workspace_id: "wH", worktree: { repo_root: "/home/user/Development/herdr-project" } },
      { workspace_id: "wI", worktree: { repo_root: "/home/user/.dotfiles" } },
    ],
  },
};

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
 * Replaces the herdr and project modules so the metadata helpers can be exercised without a running
 * Herdr session.
 *
 * @param response The response `workspace list` reports.
 * @param projects The projects `listProjects` reports.
 * @returns The mocks standing in for each replaced function.
 */
async function mockModules(response: unknown = WORKSPACES, projects: Project[] = PROJECTS) {
  const mocks = {
    runHerdr: mock(() => Promise.resolve("")),
    runHerdrJson: mock(() => Promise.resolve(response)),
    listProjects: mock(() => Promise.resolve(projects)),
  };

  await stubModule(import.meta.resolve("./herdr.ts"), () => ({
    runHerdr: mocks.runHerdr,
    runHerdrJson: mocks.runHerdrJson,
  }));
  await stubModule(import.meta.resolve("./projects.ts"), () => ({
    listProjects: mocks.listProjects,
  }));

  return mocks;
}

describe("parseRepositoryRoots", () => {
  describe("when the workspaces are backed by worktrees", () => {
    it("returns each workspace's repository root", () => {
      expect(parseRepositoryRoots(WORKSPACES)).toEqual(
        new Map([
          ["wG", "/home/user/Notes"],
          ["wH", "/home/user/Development/herdr-project"],
          ["wI", "/home/user/.dotfiles"],
        ]),
      );
    });
  });

  describe("when a workspace has no worktree", () => {
    it("leaves that workspace out", () => {
      const response = {
        result: {
          workspaces: [
            { workspace_id: "wG" },
            { workspace_id: "wH", worktree: { repo_root: "/home/user/Notes" } },
          ],
        },
      };

      expect(parseRepositoryRoots(response)).toEqual(new Map([["wH", "/home/user/Notes"]]));
    });
  });

  describe("when the response lists no workspaces", () => {
    it("returns an empty map", () => {
      expect(parseRepositoryRoots({ result: {} })).toEqual(new Map());
    });
  });
});

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

    expect(mocks.runHerdrJson).not.toHaveBeenCalled();
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

  describe("when the workspace has no worktree", () => {
    it("reports nothing", async () => {
      const mocks = await mockModules({ result: { workspaces: [{ workspace_id: "wG" }] } });

      await reportWorkspaceProject("wG");

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
      mocks.runHerdrJson.mockRejectedValue(new Error("herdr is not listening"));

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
      mocks.runHerdrJson.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportOpenWorkspaceProjects()).toContain("herdr is not listening");
    });
  });
});
