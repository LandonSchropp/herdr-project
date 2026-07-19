import { stubEnv } from "../test/helpers/env.ts";
import { expandHome, listProjects, parseProject, projectsDirectory } from "./projects.ts";
import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates a temporary projects directory containing the given TOML files and points
 * `HERDR_PROJECTS_DIRECTORY` at it.
 *
 * @param files The file names mapped to their TOML contents.
 * @returns The directory's path.
 */
async function stubProjectsDirectory(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "herdr-project-"));

  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(directory, name), contents);
  }

  stubEnv("HERDR_PROJECTS_DIRECTORY", directory);
  return directory;
}

describe("expandHome", () => {
  describe("when the path starts with a tilde", () => {
    it("expands the tilde to the home directory", () => {
      expect(expandHome("~/Development/orc")).toEqual(`${homedir()}/Development/orc`);
    });
  });

  describe("when the path is already absolute", () => {
    it("returns the path unchanged", () => {
      expect(expandHome("/tmp/project")).toEqual("/tmp/project");
    });
  });

  describe("when the path contains a tilde that does not lead it", () => {
    it("returns the path unchanged", () => {
      expect(expandHome("/tmp/~/project")).toEqual("/tmp/~/project");
    });
  });
});

describe("parseProject", () => {
  describe("when the TOML declares a name and working directory", () => {
    it("returns a project with an expanded repository root", () => {
      const contents = 'name = "orc"\nworking_dir = "~/Development/orc"\n';

      expect(parseProject(contents)).toEqual({
        name: "orc",
        repositoryRoot: `${homedir()}/Development/orc`,
      });
    });
  });

  describe("when the TOML declares extra tables", () => {
    it("ignores them", () => {
      const contents = 'name = "notes"\nworking_dir = "/tmp/notes"\n\n[[tabs]]\nname = "shell"\n';

      expect(parseProject(contents)).toEqual({ name: "notes", repositoryRoot: "/tmp/notes" });
    });
  });

  describe("when the TOML is missing a name", () => {
    it("returns null", () => {
      expect(parseProject('working_dir = "/tmp/notes"\n')).toBeNull();
    });
  });

  describe("when the TOML is missing a working directory", () => {
    it("returns null", () => {
      expect(parseProject('name = "notes"\n')).toBeNull();
    });
  });

  describe("when the TOML is malformed", () => {
    it("returns null", () => {
      expect(parseProject("name = = =")).toBeNull();
    });
  });
});

describe("projectsDirectory", () => {
  describe("when HERDR_PROJECTS_DIRECTORY is set", () => {
    it("uses it, expanding a leading tilde", () => {
      stubEnv("HERDR_PROJECTS_DIRECTORY", "~/projects");

      expect(projectsDirectory()).toEqual(`${homedir()}/projects`);
    });
  });

  describe("when HERDR_PROJECTS_DIRECTORY is not set", () => {
    it("falls back to the Herdr Plus projects directory", () => {
      stubEnv("HERDR_PROJECTS_DIRECTORY", undefined);

      expect(projectsDirectory()).toEqual(
        join(homedir(), ".config/herdr/plugins/config/cloudmanic.herdr-plus/projects"),
      );
    });
  });
});

describe("listProjects", () => {
  describe("when the directory holds project files", () => {
    it("returns them sorted by name", async () => {
      await stubProjectsDirectory({
        "zebra.toml": 'name = "zebra"\nworking_dir = "/tmp/zebra"\n',
        "apple.toml": 'name = "apple"\nworking_dir = "/tmp/apple"\n',
      });

      expect(await listProjects()).toEqual([
        { name: "apple", repositoryRoot: "/tmp/apple" },
        { name: "zebra", repositoryRoot: "/tmp/zebra" },
      ]);
    });
  });

  describe("when a file is not TOML", () => {
    it("ignores it", async () => {
      await stubProjectsDirectory({
        "notes.md": "not a project",
        "apple.toml": 'name = "apple"\nworking_dir = "/tmp/apple"\n',
      });

      expect(await listProjects()).toEqual([{ name: "apple", repositoryRoot: "/tmp/apple" }]);
    });
  });

  describe("when a project file is invalid", () => {
    it("skips it and keeps the rest", async () => {
      await stubProjectsDirectory({
        "broken.toml": "name = = =",
        "partial.toml": 'name = "partial"\n',
        "apple.toml": 'name = "apple"\nworking_dir = "/tmp/apple"\n',
      });

      expect(await listProjects()).toEqual([{ name: "apple", repositoryRoot: "/tmp/apple" }]);
    });
  });

  describe("when the directory does not exist", () => {
    it("returns an empty list", async () => {
      stubEnv("HERDR_PROJECTS_DIRECTORY", join(tmpdir(), "herdr-project-missing-directory"));

      expect(await listProjects()).toEqual([]);
    });
  });
});
