import { stubEnv } from "../test/helpers/env.ts";
import { stubModule } from "../test/helpers/module.ts";
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
  focusedTab: null,
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
      expect(flagValue(["open", "orc", "--worktree", "feature"], "--worktree")).toEqual("feature");
    });
  });

  describe("when the flag is absent", () => {
    it("returns null", () => {
      expect(flagValue(["open", "orc"], "--worktree")).toBeNull();
    });
  });

  describe("when the flag is last with no value", () => {
    it("returns null", () => {
      expect(flagValue(["open", "orc", "--worktree"], "--worktree")).toBeNull();
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

  describe("when opening without a project name", () => {
    it("reports the missing name", async () => {
      const result = await runCli(["open"]);

      expect(result.stderr).toContain("open requires a project name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when opening a project that is not configured", () => {
    it("reports the unknown project", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["open", "missing"]);

      expect(result.stderr).toContain('no project named "missing"');
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when --worktree is passed with no value", () => {
    it("reports the missing branch", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["open", "orc", "--worktree"]);

      expect(result.stderr).toContain("--worktree requires a branch name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when opening a project with a branch", () => {
    it("creates the worktree", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const createProjectWorktree = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree,
        openProjectMain: mock(() => Promise.resolve()),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli(["open", "orc", "--worktree", "feature"]);

      expect(result.exitCode).toEqual(0);
      expect(createProjectWorktree).toHaveBeenCalled();
    });
  });

  describe("when --prompt is passed with no value", () => {
    it("reports the missing value", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["open", "orc", "--prompt"]);

      expect(result.stderr).toContain("--prompt requires a value");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when opening with a prompt", () => {
    it("passes it to openProjectMain", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const openProjectMain = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree: mock(() => Promise.resolve()),
        openProjectMain,
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli(["open", "orc", "--prompt", "fix the bug"]);

      expect(result.exitCode).toEqual(0);
      expect(openProjectMain).toHaveBeenCalledWith(
        expect.objectContaining({ name: "orc" }),
        "fix the bug",
      );
    });
  });

  describe("when opening a worktree with a prompt", () => {
    it("passes it to createProjectWorktree", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const createProjectWorktree = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree,
        openProjectMain: mock(() => Promise.resolve()),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli([
        "open",
        "orc",
        "--worktree",
        "feature",
        "--prompt",
        "fix the bug",
      ]);

      expect(result.exitCode).toEqual(0);
      expect(createProjectWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ name: "orc" }),
        "feature",
        "fix the bug",
      );
    });
  });

  describe("when the action fails", () => {
    it("reports the failure", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree: mock(() => Promise.reject(new Error("herdr is not running"))),
        openProjectMain: mock(() => Promise.reject(new Error("herdr is not running"))),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      const result = await runCli(["open", "orc"]);

      expect(result.stderr).toContain("herdr is not running");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when closing without a project name", () => {
    it("reports the missing name", async () => {
      const result = await runCli(["close"]);

      expect(result.stderr).toContain("close requires a project name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when closing a project that is not configured", () => {
    it("reports the unknown project", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["close", "missing"]);

      expect(result.stderr).toContain('no project named "missing"');
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when --worktree is passed to close with no value", () => {
    it("reports the missing branch", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["close", "orc", "--worktree"]);

      expect(result.stderr).toContain("--worktree requires a branch name");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when closing a project's main workspace", () => {
    describe("when confirmed", () => {
      it("closes it", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const closeProjectMain = mock(() => Promise.resolve());
        await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
          closeProjectMain,
          closeProjectWorktree: mock(() => Promise.resolve()),
        }));
        await stubModule(import.meta.resolve("./confirm.ts"), () => ({
          confirm: mock(() => Promise.resolve(true)),
        }));

        const result = await runCli(["close", "orc"]);

        expect(closeProjectMain).toHaveBeenCalledWith(expect.objectContaining({ name: "orc" }));
        expect(result.exitCode).toEqual(0);
      });
    });

    describe("when declined", () => {
      it("cancels without closing anything", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const closeProjectMain = mock(() => Promise.resolve());
        await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
          closeProjectMain,
          closeProjectWorktree: mock(() => Promise.resolve()),
        }));
        await stubModule(import.meta.resolve("./confirm.ts"), () => ({
          confirm: mock(() => Promise.resolve(false)),
        }));

        const result = await runCli(["close", "orc"]);

        expect(closeProjectMain).not.toHaveBeenCalled();
        expect(result.stdout).toContain("Cancelled");
        expect(result.exitCode).toEqual(0);
      });
    });

    describe("when --yes is passed", () => {
      it("closes it without asking", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const closeProjectMain = mock(() => Promise.resolve());
        const confirm = mock(() => Promise.resolve(false));
        await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
          closeProjectMain,
          closeProjectWorktree: mock(() => Promise.resolve()),
        }));
        await stubModule(import.meta.resolve("./confirm.ts"), () => ({ confirm }));

        const result = await runCli(["close", "orc", "--yes"]);

        expect(confirm).not.toHaveBeenCalled();
        expect(closeProjectMain).toHaveBeenCalled();
        expect(result.exitCode).toEqual(0);
      });
    });
  });

  describe("when closing a project's worktree", () => {
    describe("when confirmed", () => {
      it("removes it", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const closeProjectWorktree = mock(() => Promise.resolve());
        const confirm = mock(() => Promise.resolve(true));
        await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
          closeProjectMain: mock(() => Promise.resolve()),
          closeProjectWorktree,
        }));
        await stubModule(import.meta.resolve("./confirm.ts"), () => ({ confirm }));

        const result = await runCli(["close", "orc", "--worktree", "feature"]);

        expect(confirm).toHaveBeenCalledWith(expect.stringContaining("feature"));
        expect(closeProjectWorktree).toHaveBeenCalledWith(
          expect.objectContaining({ name: "orc" }),
          "feature",
        );
        expect(result.exitCode).toEqual(0);
      });
    });

    describe("when declined", () => {
      it("cancels without removing anything", async () => {
        await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

        const closeProjectWorktree = mock(() => Promise.resolve());
        await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
          closeProjectMain: mock(() => Promise.resolve()),
          closeProjectWorktree,
        }));
        await stubModule(import.meta.resolve("./confirm.ts"), () => ({
          confirm: mock(() => Promise.resolve(false)),
        }));

        const result = await runCli(["close", "orc", "--worktree", "feature"]);

        expect(closeProjectWorktree).not.toHaveBeenCalled();
        expect(result.stdout).toContain("Cancelled");
        expect(result.exitCode).toEqual(0);
      });
    });
  });

  describe("when closing fails", () => {
    it("reports the failure", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        closeProjectMain: mock(() => Promise.reject(new Error("herdr is not running"))),
        closeProjectWorktree: mock(() => Promise.resolve()),
      }));
      await stubModule(import.meta.resolve("./confirm.ts"), () => ({
        confirm: mock(() => Promise.resolve(true)),
      }));

      const result = await runCli(["close", "orc"]);

      expect(result.stderr).toContain("herdr is not running");
      expect(result.exitCode).toEqual(1);
    });
  });
});

describe("runCli on-workspace", () => {
  describe("when the event carries a workspace id", () => {
    it("applies the project layout and reports what it did", async () => {
      const applyProjectLayout = mock(() => Promise.resolve("applied notes layout to w1."));
      await stubModule(import.meta.resolve("./on-workspace.ts"), () => ({
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
      await stubModule(import.meta.resolve("./on-workspace.ts"), () => ({
        applyProjectLayout: mock(() => Promise.resolve("")),
        parseEventWorkspaceId: () => null,
      }));

      const result = await runCli(["on-workspace"]);

      expect(result.stderr).toContain("no workspace id");
      expect(result.exitCode).toEqual(1);
    });
  });
});

describe("runCli on-worktree", () => {
  describe("when the event carries a worktree path", () => {
    it("copies the repository's included files and reports what it did", async () => {
      const copyWorktreeIncludes = mock(() => Promise.resolve("copied 1 path(s) into /tmp/topic."));
      await stubModule(import.meta.resolve("./on-worktree.ts"), () => ({
        copyWorktreeIncludes,
        parseEventWorktreePath: () => "/tmp/topic",
      }));

      const result = await runCli(["on-worktree"]);

      expect(copyWorktreeIncludes).toHaveBeenCalledWith("/tmp/topic");
      expect(result.stdout).toContain("copied 1 path(s)");
      expect(result.exitCode).toEqual(0);
    });
  });

  describe("when the event carries no worktree path", () => {
    it("reports the missing path", async () => {
      await stubModule(import.meta.resolve("./on-worktree.ts"), () => ({
        copyWorktreeIncludes: mock(() => Promise.resolve("")),
        parseEventWorktreePath: () => null,
      }));

      const result = await runCli(["on-worktree"]);

      expect(result.stderr).toContain("no worktree path");
      expect(result.exitCode).toEqual(1);
    });
  });
});
