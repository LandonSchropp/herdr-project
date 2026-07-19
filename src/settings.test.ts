import { stubEnv } from "../test/helpers/env.ts";
import {
  expandHome,
  loadSettings,
  parseProjects,
  parseSettings,
  parseTabs,
  settingsPath,
} from "./settings.ts";
import { describe, expect, it } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const SHELL_TAB = { name: "shell", command: null };

/**
 * Writes a settings file to a temporary directory and points `HERDR_PROJECT_SETTINGS` at it.
 *
 * @param contents The JSON contents to write.
 */
async function stubSettings(contents: string): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "herdr-project-settings-"));
  const path = join(directory, "settings.json");

  await writeFile(path, contents);
  stubEnv("HERDR_PROJECT_SETTINGS", path);
}

describe("expandHome", () => {
  describe("when the path starts with a tilde", () => {
    it("expands the tilde to the home directory", () => {
      expect(expandHome("~/Development")).toEqual(`${homedir()}/Development`);
    });
  });

  describe("when the path is already absolute", () => {
    it("returns the path unchanged", () => {
      expect(expandHome("/tmp/projects")).toEqual("/tmp/projects");
    });
  });
});

describe("settingsPath", () => {
  describe("when HERDR_PROJECT_SETTINGS is set", () => {
    it("uses it", () => {
      stubEnv("HERDR_PROJECT_SETTINGS", "~/somewhere/settings.json");

      expect(settingsPath()).toEqual(`${homedir()}/somewhere/settings.json`);
    });
  });

  describe("when HERDR_PROJECT_SETTINGS is not set", () => {
    it("falls back to the default location", () => {
      stubEnv("HERDR_PROJECT_SETTINGS", undefined);

      expect(settingsPath()).toEqual(join(homedir(), ".config/herdr-project/settings.json"));
    });
  });
});

describe("parseTabs", () => {
  describe("when the tabs declare names and commands", () => {
    it("returns them, defaulting a missing command to null", () => {
      expect(parseTabs([{ name: "shell" }, { name: "neovim", command: "nvim" }])).toEqual([
        SHELL_TAB,
        { name: "neovim", command: "nvim" },
      ]);
    });
  });

  describe("when a tab has no name", () => {
    it("skips it", () => {
      expect(parseTabs([{ command: "nvim" }, { name: "shell" }])).toEqual([SHELL_TAB]);
    });
  });

  describe("when the value is not a list", () => {
    it("returns an empty list", () => {
      expect(parseTabs(undefined)).toEqual([]);
    });
  });
});

describe("parseProjects", () => {
  describe("when a project declares a name and tabs", () => {
    it("returns them with the path expanded", () => {
      const projects = parseProjects(
        [{ name: "notes", path: "~/Notes", tabs: [{ name: "editor", command: "nvim" }] }],
        [SHELL_TAB],
      );

      expect(projects).toEqual([
        {
          name: "notes",
          repositoryRoot: `${homedir()}/Notes`,
          tabs: [{ name: "editor", command: "nvim" }],
        },
      ]);
    });
  });

  describe("when a project omits its name", () => {
    it("names it after the directory", () => {
      expect(parseProjects([{ path: "/tmp/repos/widgets" }], [SHELL_TAB])).toEqual([
        { name: "widgets", repositoryRoot: "/tmp/repos/widgets", tabs: [SHELL_TAB] },
      ]);
    });
  });

  describe("when a project omits its tabs", () => {
    it("uses the default tabs", () => {
      const defaults = [{ name: "editor", command: "nvim" }];

      expect(parseProjects([{ path: "/tmp/widgets" }], defaults)[0]?.tabs).toEqual(defaults);
    });
  });

  describe("when a project has no path", () => {
    it("skips it", () => {
      expect(parseProjects([{ name: "nowhere" }], [SHELL_TAB])).toEqual([]);
    });
  });
});

describe("parseSettings", () => {
  describe("when the settings declare every field", () => {
    it("returns them with paths expanded", () => {
      const contents = JSON.stringify({
        projectPaths: ["~/Development/*"],
        defaultTabs: [{ name: "neovim", command: "nvim" }],
        projects: [{ name: "notes", path: "/tmp/notes" }],
      });

      expect(parseSettings(contents)).toEqual({
        projectPaths: [`${homedir()}/Development/*`],
        defaultTabs: [{ name: "neovim", command: "nvim" }],
        projects: [
          {
            name: "notes",
            repositoryRoot: "/tmp/notes",
            tabs: [{ name: "neovim", command: "nvim" }],
          },
        ],
      });
    });
  });

  describe("when the settings are empty", () => {
    it("returns the defaults", () => {
      expect(parseSettings("{}")).toEqual({
        projectPaths: [],
        defaultTabs: [SHELL_TAB],
        projects: [],
      });
    });
  });

  describe("when the JSON is malformed", () => {
    it("returns null", () => {
      expect(parseSettings("{ not json")).toBeNull();
    });
  });

  describe("when the JSON is not an object", () => {
    it("returns null", () => {
      expect(parseSettings("[]")).toBeNull();
    });
  });
});

describe("loadSettings", () => {
  describe("when the settings file exists", () => {
    it("returns its contents", async () => {
      await stubSettings(JSON.stringify({ projectPaths: ["/tmp/repos/*"] }));

      expect((await loadSettings()).projectPaths).toEqual(["/tmp/repos/*"]);
    });
  });

  describe("when the settings file is missing", () => {
    it("returns the defaults", async () => {
      stubEnv("HERDR_PROJECT_SETTINGS", join(tmpdir(), "herdr-project-absent", "settings.json"));

      expect(await loadSettings()).toEqual({
        projectPaths: [],
        defaultTabs: [SHELL_TAB],
        projects: [],
      });
    });
  });

  describe("when the settings file is malformed", () => {
    it("returns the defaults", async () => {
      await stubSettings("{ not json");

      expect((await loadSettings()).projectPaths).toEqual([]);
    });
  });
});
