import { stubEnv } from "../test/helpers/env.ts";
import { stubModule } from "../test/helpers/module.ts";
import { flagValue, formatProjects, runCli } from "./cli.ts";
import type { Project } from "./types.ts";
import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Writes a settings file declaring the given projects and points `HERDR_PROJECT_SETTINGS` at it.
 *
 * @param projects The projects to declare.
 */
async function stubProjects(
  projects: { name: string; path: string; prompt?: string }[],
): Promise<void> {
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

  describe("when the flag is followed by another flag", () => {
    it("returns null rather than treating the flag as the value", () => {
      expect(flagValue(["open", "orc", "--worktree", "--yes"], "--worktree")).toBeNull();
    });
  });
});

describe("formatProjects", () => {
  const PROJECTS: Project[] = [
    {
      name: "orc",
      repositoryRoot: "/tmp/orc",
      tabs: [{ name: "shell", command: null }],
      focusedTab: null,
      prompt: null,
    },
    { name: "notes", repositoryRoot: "/tmp/notes", tabs: [], focusedTab: null, prompt: null },
  ];

  describe("when stdout is a TTY", () => {
    it("prints an aligned table", () => {
      const lines = formatProjects(PROJECTS, false, true).split("\n");

      expect(lines[0]?.split(/\s{2,}/)).toEqual(["NAME", "PATH"]);
      expect(lines[1]?.split(/\s{2,}/)).toEqual(["orc", "/tmp/orc"]);
      expect(lines[2]?.split(/\s{2,}/)).toEqual(["notes", "/tmp/notes"]);
      expect(lines[3]).toEqual("");
    });
  });

  describe("when stdout is not a TTY", () => {
    it("prints tab-separated lines instead, for scripts and agents", () => {
      expect(formatProjects(PROJECTS, false, false)).toEqual("orc\t/tmp/orc\nnotes\t/tmp/notes\n");
    });
  });

  describe("when formatting as JSON", () => {
    it("prints the name, path, and tabs regardless of TTY", () => {
      expect(JSON.parse(formatProjects(PROJECTS, true, false))).toEqual([
        { name: "orc", path: "/tmp/orc", tabs: [{ name: "shell", command: null }] },
        { name: "notes", path: "/tmp/notes", tabs: [] },
      ]);
    });
  });

  describe("when a project's path is under the home directory", () => {
    const HOME_PROJECTS: Project[] = [
      {
        name: "orc",
        repositoryRoot: `${homedir()}/Development/orc`,
        tabs: [],
        focusedTab: null,
        prompt: null,
      },
    ];

    it("collapses it to a tilde in the table", () => {
      const lines = formatProjects(HOME_PROJECTS, false, true).split("\n");

      expect(lines[1]?.split(/\s{2,}/)).toEqual(["orc", "~/Development/orc"]);
    });

    it("collapses it to a tilde in tab-separated lines", () => {
      expect(formatProjects(HOME_PROJECTS, false, false)).toEqual("orc\t~/Development/orc\n");
    });

    it("leaves it expanded in JSON", () => {
      expect(JSON.parse(formatProjects(HOME_PROJECTS, true, false))).toEqual([
        { name: "orc", path: `${homedir()}/Development/orc`, tabs: [] },
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
      expect(createProjectWorktree).toHaveBeenCalledWith(expect.anything(), "feature", true);
    });
  });

  describe("when --prompt is passed with no value", () => {
    it("reports the missing text", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const result = await runCli(["open", "orc", "--prompt"]);

      expect(result.stderr).toContain("--prompt requires a value");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when opening a project with --prompt", () => {
    it("opens the main workspace with the prompt", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc", prompt: "read the AGENTS file" }]);

      const openProjectMain = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree: mock(() => Promise.resolve()),
        openProjectMain,
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      await runCli(["open", "orc", "--prompt", "read the README"]);

      expect(openProjectMain).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: "read the README" }),
        true,
      );
    });
  });

  describe("when opening a project with --no-focus", () => {
    it("opens the main workspace in the background", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const openProjectMain = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree: mock(() => Promise.resolve()),
        openProjectMain,
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      await runCli(["open", "orc", "--no-focus"]);

      expect(openProjectMain).toHaveBeenCalledWith(expect.anything(), false);
    });
  });

  describe("when opening a project with a branch and --no-focus", () => {
    it("creates the worktree in the background", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const createProjectWorktree = mock(() => Promise.resolve());
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        createProjectWorktree,
        openProjectMain: mock(() => Promise.resolve()),
        openProjectWorktree: mock(() => Promise.resolve()),
      }));

      await runCli(["open", "orc", "--worktree", "feature", "--no-focus"]);

      expect(createProjectWorktree).toHaveBeenCalledWith(expect.anything(), "feature", false);
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
        await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
          confirm: mock(() => Promise.resolve(true)),
          isInteractive: mock(() => true),
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
        await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
          confirm: mock(() => Promise.resolve(false)),
          isInteractive: mock(() => true),
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
        await stubModule(import.meta.resolve("./confirm.tsx"), () => ({ confirm }));

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
        await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
          confirm,
          isInteractive: mock(() => true),
        }));

        const result = await runCli(["close", "orc", "--worktree", "feature"]);

        expect(confirm).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringContaining("feature"),
        );
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
        await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
          confirm: mock(() => Promise.resolve(false)),
          isInteractive: mock(() => true),
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
      await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
        confirm: mock(() => Promise.resolve(true)),
        isInteractive: mock(() => true),
      }));

      const result = await runCli(["close", "orc"]);

      expect(result.stderr).toContain("herdr is not running");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when closing a project's main workspace without --yes in a non-interactive environment", () => {
    it("reports the missing flag rather than asking", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const closeProjectMain = mock(() => Promise.resolve());
      const confirm = mock(() => Promise.resolve(true));
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        closeProjectMain,
        closeProjectWorktree: mock(() => Promise.resolve()),
      }));
      await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
        confirm,
        isInteractive: mock(() => false),
      }));

      const result = await runCli(["close", "orc"]);

      expect(confirm).not.toHaveBeenCalled();
      expect(closeProjectMain).not.toHaveBeenCalled();
      expect(result.stderr).toContain("requires --yes");
      expect(result.exitCode).toEqual(1);
    });
  });

  describe("when closing a project's worktree without --yes in a non-interactive environment", () => {
    it("reports the missing flag rather than asking", async () => {
      await stubProjects([{ name: "orc", path: "/tmp/orc" }]);

      const closeProjectWorktree = mock(() => Promise.resolve());
      const confirm = mock(() => Promise.resolve(true));
      await stubModule(import.meta.resolve("./workspaces.ts"), () => ({
        closeProjectMain: mock(() => Promise.resolve()),
        closeProjectWorktree,
      }));
      await stubModule(import.meta.resolve("./confirm.tsx"), () => ({
        confirm,
        isInteractive: mock(() => false),
      }));

      const result = await runCli(["close", "orc", "--worktree", "feature"]);

      expect(confirm).not.toHaveBeenCalled();
      expect(closeProjectWorktree).not.toHaveBeenCalled();
      expect(result.stderr).toContain("requires --yes");
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
