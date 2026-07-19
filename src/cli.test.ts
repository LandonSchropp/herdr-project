import { stubEnv } from "../test/helpers/env.ts";
import { flagValue, formatProjects, runCli } from "./cli.ts";
import type { Project } from "./types.ts";
import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PROJECT: Project = {
  name: "orc",
  repositoryRoot: "/tmp/orc",
  tabs: [{ name: "shell", command: null }],
};

/**
 * Writes a settings file declaring the given projects and points `HERDR_PROJECT_SETTINGS` at it.
 *
 * @param projects The projects to declare.
 */
async function stubProjects(projects: { name: string; path: string }[]): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "herdr-project-cli-"));
  const path = join(directory, "settings.json");

  await writeFile(path, JSON.stringify({ projects }));
  stubEnv("HERDR_PROJECT_SETTINGS", path);
}

describe("flagValue", () => {
  describe("when the flag has a value", () => {
    it("returns it", () => {
      expect(flagValue(["create", "orc", "--branch", "feature"], "--branch")).toEqual("feature");
    });
  });

  describe("when the flag is absent", () => {
    it("returns null", () => {
      expect(flagValue(["create", "orc"], "--branch")).toBeNull();
    });
  });

  describe("when the flag is last with no value", () => {
    it("returns null", () => {
      expect(flagValue(["create", "orc", "--branch"], "--branch")).toBeNull();
    });
  });
});

describe("formatProjects", () => {
  describe("when formatting as lines", () => {
    it("prints the name and path separated by a tab", () => {
      expect(formatProjects([PROJECT], false)).toEqual("orc\t/tmp/orc\n");
    });
  });

  describe("when formatting as JSON", () => {
    it("prints the name, path, and tabs", () => {
      expect(JSON.parse(formatProjects([PROJECT], true))).toEqual([
        { name: "orc", path: "/tmp/orc", tabs: [{ name: "shell", command: null }] },
      ]);
    });
  });
});

describe("runCli", () => {
  describe("when asked for help", () => {
    it("prints usage and exits zero", async () => {
      const result = await runCli(["--help"]);

      expect(result.stdout).toContain("Usage:");
      expect(result.exitCode).toEqual(0);
    });
  });

  describe("when the command is unknown", () => {
    it("prints usage and exits non-zero", async () => {
      const result = await runCli(["nonsense"]);

      expect(result.stderr).toContain('unknown command "nonsense"');
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when listing projects", () => {
    it("prints one per line", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["list"]);

      expect(result.stdout).toEqual("orc\t/tmp/orc\n");
      expect(result.exitCode).toEqual(0);
    });

    describe("when --json is passed", () => {
      it("prints JSON", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const result = await runCli(["list", "--json"]);

        expect(JSON.parse(result.stdout)).toEqual([
          { name: "orc", path: "/tmp/orc", tabs: [{ name: "shell", command: null }] },
        ]);
      });
    });
  });

  describe("when creating without a project name", () => {
    it("reports the missing name", async () => {
      const result = await runCli(["create"]);

      expect(result.stderr).toContain("create requires a project name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when creating a project that is not configured", () => {
    it("reports the unknown project", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["create", "missing"]);

      expect(result.stderr).toContain('no project named "missing"');
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when --branch is passed with no value", () => {
    it("reports the missing branch", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["create", "orc", "--branch"]);

      expect(result.stderr).toContain("--branch requires a branch name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when creating a project with a branch", () => {
    it("creates the worktree", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const createProjectWorktree = mock(() => Promise.resolve());
      await mock.module("./workspaces.ts", () => ({
        createProjectWorktree,
        openProjectMain: mock(() => Promise.resolve()),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli(["create", "orc", "--branch", "feature"]);

      expect(result.exitCode).toEqual(0);
      expect(createProjectWorktree).toHaveBeenCalled();
    });
  });

  describe("when the action fails", () => {
    it("reports the failure", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      await mock.module("./workspaces.ts", () => ({
        createProjectWorktree: mock(() => Promise.reject(new Error("herdr is not running"))),
        openProjectMain: mock(() => Promise.reject(new Error("herdr is not running"))),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli(["create", "orc"]);

      expect(result.stderr).toContain("herdr is not running");
      expect(result.exitCode).toEqual(1);
    });
  });
});

describe("runCli on-workspace", () => {
  describe("when the event carries a workspace id", () => {
    it("applies the project layout and reports what it did", async () => {
      const applyProjectLayout = mock(() => Promise.resolve("applied notes layout to w1."));
      await mock.module("./on-workspace.ts", () => ({
        applyProjectLayout,
        parseEventWorkspaceId: () => "w1",
      }));

      const result = await runCli(["on-workspace"]);

      expect(applyProjectLayout).toHaveBeenCalledWith("w1");
      expect(result.stdout).toContain("applied notes layout");
      expect(result.exitCode).toEqual(0);
    });
  });

  describe("when the event carries no workspace id", () => {
    it("reports the missing id", async () => {
      await mock.module("./on-workspace.ts", () => ({
        applyProjectLayout: mock(() => Promise.resolve("")),
        parseEventWorkspaceId: () => null,
      }));

      const result = await runCli(["on-workspace"]);

      expect(result.stderr).toContain("no workspace id");
      expect(result.exitCode).toEqual(1);
    });
  });
});
