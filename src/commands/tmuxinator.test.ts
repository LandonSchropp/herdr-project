import { XDG_CONFIG_HOME } from "../directories.ts";
import type { RunCommandOptions, RunCommandResultWithExitCode } from "./shell.ts";
import {
  isTmuxinatorInstalled,
  listTmuxinatorProjects,
  readTmuxinatorProject,
  startTmuxinatorProject,
  tmuxinatorConfigPath,
  tmuxinatorProjectExists,
} from "./tmuxinator.ts";
import { YAML } from "bun";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { homedir } from "node:os";
import { dedent } from "ts-dedent";

const runCommandMock = mock<
  (command: string[], options?: RunCommandOptions) => Promise<RunCommandResultWithExitCode>
>(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }));

await mock.module("./shell.ts", () => ({
  runCommand: runCommandMock,
}));

describe("isTmuxinatorInstalled", () => {
  describe("when tmuxinator is available", () => {
    it("returns true", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      expect(await isTmuxinatorInstalled()).toBe(true);
    });
  });

  describe("when tmuxinator is not available", () => {
    it("returns false", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" });
      expect(await isTmuxinatorInstalled()).toBe(false);
    });
  });

  describe("when tmuxinator is not installed", () => {
    it("returns false", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 127, stdout: "", stderr: "" });
      expect(await isTmuxinatorInstalled()).toBe(false);
    });
  });
});

describe("listTmuxinatorProjects", () => {
  describe("when projects exist", () => {
    it("returns the parsed projects without the header", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "tmuxinator projects:\nagent-toolkit\nnotes\n",
        stderr: "",
      });
      await Bun.write(
        `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`,
        "name: agent-toolkit\nroot: ~/Development/agent-toolkit\n",
      );
      await Bun.write(`${XDG_CONFIG_HOME}/tmuxinator/notes.yml`, "name: notes\nroot: ~/Notes\n");

      expect(await listTmuxinatorProjects()).toEqual([
        { name: "agent-toolkit", root: `${homedir()}/Development/agent-toolkit` },
        { name: "notes", root: `${homedir()}/Notes` },
      ]);
    });
  });

  describe("when no projects exist", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "tmuxinator projects:\n",
        stderr: "",
      });
      expect(await listTmuxinatorProjects()).toEqual([]);
    });
  });

  describe("when the built-in default project is present", () => {
    it("filters out the default project", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "tmuxinator projects:\nagent-toolkit\ndefault\nnotes\n",
        stderr: "",
      });
      await Bun.write(
        `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`,
        "name: agent-toolkit\nroot: ~/\n",
      );
      await Bun.write(`${XDG_CONFIG_HOME}/tmuxinator/notes.yml`, "name: notes\nroot: ~/\n");

      expect((await listTmuxinatorProjects()).map((project) => project.name)).toEqual([
        "agent-toolkit",
        "notes",
      ]);
    });
  });
});

describe("tmuxinatorConfigPath", () => {
  it("returns the project YAML under $XDG_CONFIG_HOME/tmuxinator", () => {
    expect(tmuxinatorConfigPath("agent-toolkit")).toBe(
      `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`,
    );
  });
});

describe("tmuxinatorProjectExists", () => {
  const configPath = `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`;

  describe("when the project config exists", () => {
    beforeEach(async () => {
      await Bun.write(configPath, "name: agent-toolkit\nroot: ~/Development/agent-toolkit\n");
    });

    it("returns true", async () => {
      expect(await tmuxinatorProjectExists("agent-toolkit")).toBe(true);
    });
  });

  describe("when the project config does not exist", () => {
    it("returns false", async () => {
      expect(await tmuxinatorProjectExists("agent-toolkit")).toBe(false);
    });
  });
});

describe("readTmuxinatorProject", () => {
  const configPath = `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`;

  describe("when the file contains a valid YAML config", () => {
    beforeEach(async () => {
      await Bun.write(
        configPath,
        dedent`
          name: agent-toolkit
          root: ~/Development/agent-toolkit
          windows:
            - shell:
            - vim: nvim
        `,
      );
    });

    it("parses the project and expands `~/` in `root`", async () => {
      expect(await readTmuxinatorProject("agent-toolkit")).toEqual({
        name: "agent-toolkit",
        root: `${homedir()}/Development/agent-toolkit`,
        windows: [{ shell: null }, { vim: "nvim" }],
      });
    });
  });

  describe("when the file does not exist", () => {
    it("throws an error", () => {
      expect(readTmuxinatorProject("agent-toolkit")).rejects.toThrow();
    });
  });

  describe("when the YAML is malformed", () => {
    beforeEach(async () => {
      await Bun.write(configPath, "name: agent-toolkit\nroot: [unclosed\n");
    });

    it("throws an error", () => {
      expect(readTmuxinatorProject("agent-toolkit")).rejects.toThrow();
    });
  });

  describe("when the project is missing a name field", () => {
    beforeEach(async () => {
      await Bun.write(configPath, "root: ~/Development/agent-toolkit\n");
    });

    it("throws an error", () => {
      expect(readTmuxinatorProject("agent-toolkit")).rejects.toThrow(/missing a string `name`/);
    });
  });

  describe("when the project has no root field", () => {
    beforeEach(async () => {
      await Bun.write(
        configPath,
        dedent`
          name: agent-toolkit
          windows:
            - shell:
        `,
      );
    });

    it("parses the project with a null root", async () => {
      expect(await readTmuxinatorProject("agent-toolkit")).toEqual({
        name: "agent-toolkit",
        root: null,
        windows: [{ shell: null }],
      });
    });
  });
});

describe("startTmuxinatorProject", () => {
  beforeEach(async () => {
    await Bun.write(
      `${XDG_CONFIG_HOME}/tmuxinator/agent-toolkit.yml`,
      dedent`
        name: agent-toolkit
        root: ~/Development/agent-toolkit
      `,
    );
  });

  describe("when tmuxinator succeeds", () => {
    beforeEach(async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      await startTmuxinatorProject("agent-toolkit", "feature-a", "/tmp/worktree");
    });

    it("invokes `tmuxinator start` with `--no-attach`", () => {
      expect(runCommandMock).toHaveBeenCalledWith([
        "tmuxinator",
        "start",
        "-p",
        expect.stringMatching(/\/orc-[^/]+\/project\.yml$/),
        "--no-attach",
      ]);
    });

    it("writes the modified config with the qualified session name, overridden root, and orc socket", async () => {
      const args = runCommandMock.mock.calls[0][0];
      const configPath = args[args.indexOf("-p") + 1];

      expect(YAML.parse(await Bun.file(configPath).text())).toEqual({
        name: "agent-toolkit/feature-a",
        root: "/tmp/worktree",
        pre_window: [
          "export ORC_PROJECT=agent-toolkit",
          "export ORC_SESSION=feature-a",
          "export ORC_WORKTREE=/tmp/worktree",
        ],
        tmux_options: "-L orc",
      });
    });
  });

  describe("when a template project is given", () => {
    beforeEach(async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      await Bun.write(
        `${XDG_CONFIG_HOME}/tmuxinator/default.yml`,
        dedent`
          name: default
          root: ~/
          windows:
            - editor: nvim
        `,
      );
      await startTmuxinatorProject("my-directory", "feature-a", "/tmp/worktree", "default");
    });

    it("uses the template's layout but the project's session name and root", async () => {
      const args = runCommandMock.mock.calls[0][0];
      const configPath = args[args.indexOf("-p") + 1];

      expect(YAML.parse(await Bun.file(configPath).text())).toEqual({
        name: "my-directory/feature-a",
        root: "/tmp/worktree",
        pre_window: [
          "export ORC_PROJECT=my-directory",
          "export ORC_SESSION=feature-a",
          "export ORC_WORKTREE=/tmp/worktree",
        ],
        tmux_options: "-L orc",
        windows: [{ editor: "nvim" }],
      });
    });
  });

  describe("when the template has no root", () => {
    beforeEach(async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      await Bun.write(
        `${XDG_CONFIG_HOME}/tmuxinator/default.yml`,
        dedent`
          name: default
          windows:
            - shell:
            - claude: claude
        `,
      );
      await startTmuxinatorProject("my-directory", "feature-a", "/tmp/worktree", "default");
    });

    it("starts the session using the overridden root", async () => {
      const args = runCommandMock.mock.calls[0][0];
      const configPath = args[args.indexOf("-p") + 1];

      expect(YAML.parse(await Bun.file(configPath).text())).toEqual({
        name: "my-directory/feature-a",
        root: "/tmp/worktree",
        pre_window: [
          "export ORC_PROJECT=my-directory",
          "export ORC_SESSION=feature-a",
          "export ORC_WORKTREE=/tmp/worktree",
        ],
        tmux_options: "-L orc",
        windows: [{ shell: null }, { claude: "claude" }],
      });
    });
  });

  describe("when the template already defines pre_window commands", () => {
    beforeEach(async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      await Bun.write(
        `${XDG_CONFIG_HOME}/tmuxinator/default.yml`,
        dedent`
          name: default
          root: ~/
          pre_window:
            - rbenv shell 3.3.0
            - nvm use
          windows:
            - shell:
        `,
      );
      await startTmuxinatorProject("my-directory", "feature-a", "/tmp/worktree", "default");
    });

    it("prepends the orc context exports without dropping the template's commands", async () => {
      const args = runCommandMock.mock.calls[0][0];
      const configPath = args[args.indexOf("-p") + 1];

      expect(YAML.parse(await Bun.file(configPath).text())).toEqual({
        name: "my-directory/feature-a",
        root: "/tmp/worktree",
        pre_window: [
          "export ORC_PROJECT=my-directory",
          "export ORC_SESSION=feature-a",
          "export ORC_WORKTREE=/tmp/worktree",
          "rbenv shell 3.3.0",
          "nvm use",
        ],
        tmux_options: "-L orc",
        windows: [{ shell: null }],
      });
    });
  });

  describe("when tmuxinator fails", () => {
    beforeEach(() => {
      runCommandMock.mockRejectedValue(new Error("could not start tmuxinator"));
    });

    it("propagates the error", () => {
      expect(startTmuxinatorProject("agent-toolkit", "feature-a", "/tmp/worktree")).rejects.toThrow(
        /could not start tmuxinator/,
      );
    });
  });
});
