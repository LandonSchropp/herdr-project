import { stubEnv } from "../test/helpers/env.ts";
import { discoverProjects, listProjects, mergeProjects, scanRepositories } from "./projects.ts";
import type { Project, Settings } from "./types.ts";
import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SHELL_TAB = { name: "shell", command: null };

/**
 * Creates a temporary directory holding the named repositories. Repositories are created with a
 * `.git` directory, as a normal checkout has; any name in `linkedWorktrees` gets a `.git` file
 * instead, as a linked worktree has.
 *
 * @param repositories The directory names to create as normal checkouts.
 * @param options The other directories to create alongside them.
 * @param options.linkedWorktrees Names to create with a `.git` file rather than a directory.
 * @param options.plainDirectories Names to create with no `.git` entry at all.
 * @returns The temporary directory's path.
 */
async function stubRepositories(
  repositories: string[],
  options: { linkedWorktrees?: string[]; plainDirectories?: string[] } = {},
): Promise<string> {
  const { linkedWorktrees = [], plainDirectories = [] } = options;
  const root = await mkdtemp(join(tmpdir(), "herdr-project-repos-"));

  for (const name of repositories) {
    await mkdir(join(root, name, ".git"), { recursive: true });
  }

  for (const name of linkedWorktrees) {
    await mkdir(join(root, name), { recursive: true });
    await writeFile(join(root, name, ".git"), "gitdir: elsewhere");
  }

  for (const name of plainDirectories) {
    await mkdir(join(root, name), { recursive: true });
  }

  return root;
}

/**
 * Builds settings for the discovery tests.
 *
 * @param overrides The fields to override on the defaults.
 * @returns The settings.
 */
function buildSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    projectPaths: [],
    flat: false,
    defaultTabs: [SHELL_TAB],
    defaultFocusedTab: null,
    projects: [],
    ...overrides,
  };
}

describe("scanRepositories", () => {
  describe("when the glob matches Git repositories", () => {
    it("returns normal checkouts and linked worktrees, but not plain directories", async () => {
      const root = await stubRepositories(["alpha", "beta"], {
        linkedWorktrees: ["gamma"],
        plainDirectories: ["not-a-repository"],
      });

      const found = await scanRepositories(join(root, "*"));

      expect(found.map((path) => path.replace(`${root}/`, "")).sort()).toEqual([
        "alpha",
        "beta",
        "gamma",
      ]);
    });
  });

  describe("when the glob matches nothing", () => {
    it("returns an empty list", async () => {
      const root = await stubRepositories([]);

      expect(await scanRepositories(join(root, "*"))).toEqual([]);
    });
  });

  describe("when the glob's directory does not exist", () => {
    it("returns an empty list", async () => {
      const root = await stubRepositories([]);

      expect(await scanRepositories(join(root, "missing", "*"))).toEqual([]);
    });
  });

  describe("when the path has no wildcards and is a repository", () => {
    it("returns that repository", async () => {
      const root = await stubRepositories(["alpha"]);

      expect(await scanRepositories(join(root, "alpha"))).toEqual([join(root, "alpha")]);
    });
  });

  describe("when the path has no wildcards and is not a repository", () => {
    it("returns an empty list", async () => {
      const root = await stubRepositories([], { plainDirectories: ["alpha"] });

      expect(await scanRepositories(join(root, "alpha"))).toEqual([]);
    });
  });

  describe("when the directory's own name contains wildcard characters", () => {
    it("still resolves it", async () => {
      const root = await stubRepositories(["weird[1]"]);

      expect(await scanRepositories(join(root, "weird[1]"))).toEqual([join(root, "weird[1]")]);
    });
  });

  describe("when a repository matches both the path itself and the glob", () => {
    it("returns it once", async () => {
      const root = await stubRepositories(["alpha"]);

      expect(await scanRepositories(join(root, "alpha*"))).toEqual([join(root, "alpha")]);
    });
  });
});

describe("discoverProjects", () => {
  describe("when repositories are found", () => {
    it("names each project after its directory and gives it the default tabs", async () => {
      const root = await stubRepositories(["widgets"]);
      const defaultTabs = [{ name: "editor", command: "nvim" }];

      const projects = await discoverProjects(
        buildSettings({ projectPaths: [join(root, "*")], defaultTabs }),
      );

      expect(projects).toEqual([
        {
          name: "widgets",
          repositoryRoot: join(root, "widgets"),
          tabs: defaultTabs,
          focusedTab: null,
          prompt: null,
        },
      ]);
    });
  });

  describe("when a default focused tab is set", () => {
    it("gives each project the default focused tab", async () => {
      const root = await stubRepositories(["widgets"]);

      const projects = await discoverProjects(
        buildSettings({ projectPaths: [join(root, "*")], defaultFocusedTab: "claude" }),
      );

      expect(projects[0]?.focusedTab).toEqual("claude");
    });
  });

  describe("when no project paths are configured", () => {
    it("returns an empty list", async () => {
      expect(await discoverProjects(buildSettings())).toEqual([]);
    });
  });
});

describe("mergeProjects", () => {
  const declared: Project = {
    name: "custom",
    repositoryRoot: "/tmp/widgets",
    tabs: [{ name: "editor", command: "nvim" }],
    focusedTab: null,
    prompt: null,
  };

  describe("when a discovered project shares a declared project's path", () => {
    it("keeps the declared project and drops the discovered one", () => {
      const discovered: Project = {
        name: "widgets",
        repositoryRoot: "/tmp/widgets",
        tabs: [SHELL_TAB],
        focusedTab: null,
        prompt: null,
      };

      expect(mergeProjects([declared], [discovered])).toEqual([declared]);
    });
  });

  describe("when a discovered project is at a different path", () => {
    it("keeps both, sorted by name", () => {
      const discovered: Project = {
        name: "apple",
        repositoryRoot: "/tmp/apple",
        tabs: [SHELL_TAB],
        focusedTab: null,
        prompt: null,
      };

      expect(mergeProjects([declared], [discovered]).map((project) => project.name)).toEqual([
        "apple",
        "custom",
      ]);
    });
  });
});

describe("listProjects", () => {
  describe("when settings declare projects and project paths", () => {
    it("returns both, sorted by name", async () => {
      const root = await stubRepositories(["zebra"]);
      const settingsDirectory = await mkdtemp(join(tmpdir(), "herdr-project-settings-"));
      const settingsFile = join(settingsDirectory, "settings.json");

      await writeFile(
        settingsFile,
        JSON.stringify({
          projectPaths: [join(root, "*")],
          projects: [{ name: "apple", path: "/tmp/apple" }],
        }),
      );
      stubEnv("HERDR_PROJECT_SETTINGS", settingsFile);

      expect((await listProjects()).map((project) => project.name)).toEqual(["apple", "zebra"]);
    });
  });
});
