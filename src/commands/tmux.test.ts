import { stubEnv } from "../../test/helpers/env.ts";
import { worktreePath } from "../sessions/paths.ts";
import {
  attachTmuxSession,
  createTmuxSession,
  createTmuxSessionUnlessExists,
  sessionId,
  detachTmuxClient,
  hasTmuxSession,
  isInsideOrcTmuxSession,
  isTmuxInstalled,
  killTmuxSession,
  currentTmuxSession,
  listTmuxPanes,
  listTmuxSessions,
  previousTmuxSession,
  switchTmuxSession,
} from "./tmux.ts";
import { describe, expect, it, mock } from "bun:test";

const runCommandMock = mock(() => Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }));
const runAttachedCommandMock = mock((): Promise<number> => Promise.resolve(0));

await mock.module("./shell.ts", () => ({
  runCommand: runCommandMock,
  runAttachedCommand: runAttachedCommandMock,
}));

describe("isTmuxInstalled", () => {
  describe("when tmux is available", () => {
    it("returns true", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      expect(await isTmuxInstalled()).toBe(true);
    });
  });

  describe("when tmux is not available", () => {
    it("returns false", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" });
      expect(await isTmuxInstalled()).toBe(false);
    });
  });

  describe("when tmux is not installed", () => {
    it("returns false", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 127, stdout: "", stderr: "" });
      expect(await isTmuxInstalled()).toBe(false);
    });
  });
});

describe("isInsideOrcTmuxSession", () => {
  describe("when $TMUX is not set", () => {
    it("returns false", () => {
      stubEnv("TMUX", undefined);
      expect(isInsideOrcTmuxSession()).toBe(false);
    });
  });

  describe("when $TMUX points to a different socket", () => {
    it("returns false", () => {
      stubEnv("TMUX", "/tmp/tmux-501/default,12345,0");
      expect(isInsideOrcTmuxSession()).toBe(false);
    });
  });

  describe("when $TMUX points to the orc socket", () => {
    it("returns true", () => {
      stubEnv("TMUX", "/tmp/tmux-501/orc,12345,0");
      expect(isInsideOrcTmuxSession()).toBe(true);
    });
  });
});

describe("listTmuxSessions", () => {
  describe("when the orc tmux server is not running", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "no server running on /tmp/tmux-501/orc\n",
      });
      expect(await listTmuxSessions()).toEqual([]);
    });
  });

  describe("when the orc socket does not exist", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "error connecting to /private/tmp/tmux-501/orc (No such file or directory)\n",
      });
      expect(await listTmuxSessions()).toEqual([]);
    });
  });

  describe("when the orc tmux server is shutting down", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "server exited unexpectedly\n",
      });
      expect(await listTmuxSessions()).toEqual([]);
    });
  });

  describe("when the connection to the orc tmux server is lost", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "lost server\n",
      });
      expect(await listTmuxSessions()).toEqual([]);
    });
  });

  describe("when there are no sessions", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      expect(await listTmuxSessions()).toEqual([]);
    });
  });

  describe("when there are sessions", () => {
    it("returns an array of parsed session objects", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout:
          `orc/feature-a\t1700000000\t${worktreePath("orc", "feature-a")}\n` +
          `orc/feature-b\t1700000100\t/repos/orc\n`,
        stderr: "",
      });
      expect(await listTmuxSessions()).toEqual([
        {
          project: "orc",
          session: "feature-a",
          id: "orc/feature-a",
          createdAt: new Date(1_700_000_000 * 1000),
          worktree: "linked",
        },
        {
          project: "orc",
          session: "feature-b",
          id: "orc/feature-b",
          createdAt: new Date(1_700_000_100 * 1000),
          worktree: "main",
        },
      ]);
    });
  });

  describe("when a session name is missing a slash", () => {
    it("skips that session and returns the rest", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout:
          `dotfiles\t1700000000\t/repos/dotfiles\n` + `orc/feature-a\t1700000100\t/repos/orc\n`,
        stderr: "",
      });
      expect(await listTmuxSessions()).toEqual([
        {
          project: "orc",
          session: "feature-a",
          id: "orc/feature-a",
          createdAt: new Date(1_700_000_100 * 1000),
          worktree: "main",
        },
      ]);
    });
  });

  describe("when tmux exits with an unexpected error", () => {
    it("throws an error", () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "some other tmux error\n",
      });
      expect(listTmuxSessions()).rejects.toThrowError(/some other tmux error/);
    });
  });
});

describe("switchTmuxSession", () => {
  it("invokes `tmux switch-client` against the orc server", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    await switchTmuxSession("orc/feature-a");
    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "switch-client",
      "-t",
      "orc/feature-a",
    ]);
  });
});

describe("attachTmuxSession", () => {
  it("invokes `tmux attach-session` against the orc server", async () => {
    runAttachedCommandMock.mockResolvedValue(0);
    await attachTmuxSession("orc/feature-a");
    expect(runAttachedCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "attach-session",
      "-t",
      "orc/feature-a",
    ]);
  });
});

describe("hasTmuxSession", () => {
  describe("when the session exists", () => {
    it("returns true", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
      expect(await hasTmuxSession("orc")).toBe(true);
    });
  });

  describe("when the session does not exist", () => {
    it("returns false", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "can't find session: orc\n",
      });
      expect(await hasTmuxSession("orc")).toBe(false);
    });
  });

  it("invokes `tmux has-session` against the orc server", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await hasTmuxSession("orc");

    expect(runCommandMock).toHaveBeenCalledWith(["tmux", "-L", "orc", "has-session", "-t", "orc"]);
  });
});

describe("createTmuxSession", () => {
  it("invokes `tmux new-session` detached, running the given command", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await createTmuxSession("orc", "orc --tui");

    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "new-session",
      "-d",
      "-s",
      "orc",
      "orc --tui",
    ]);
  });

  describe("when the status bar is disabled", () => {
    it("hides the session's status bar in the same invocation", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await createTmuxSession("orc", "orc --tui", { statusBar: false });

      expect(runCommandMock).toHaveBeenCalledWith([
        "tmux",
        "-L",
        "orc",
        "new-session",
        "-d",
        "-s",
        "orc",
        "orc --tui",
        ";",
        "set-option",
        "-t",
        "orc",
        "status",
        "off",
      ]);
    });
  });

  describe("when tmux fails", () => {
    it("throws an error with the stderr message", () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "duplicate session: orc\n",
      });

      expect(createTmuxSession("orc", "orc --tui")).rejects.toThrowError(/duplicate session/);
    });
  });
});

describe("currentTmuxSession", () => {
  it("invokes `tmux display-message` for the current session name", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "orc/feature-a\n", stderr: "" });

    await currentTmuxSession();

    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "display-message",
      "-p",
      "#{session_name}",
    ]);
  });

  describe("when there is a current session", () => {
    it("returns its name", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "orc/feature-a\n", stderr: "" });
      expect(await currentTmuxSession()).toBe("orc/feature-a");
    });
  });

  describe("when there is no current session", () => {
    it("returns null", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "no current client\n",
      });
      expect(await currentTmuxSession()).toBeNull();
    });
  });
});

describe("previousTmuxSession", () => {
  it("invokes `tmux display-message` for the client's last session", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "orc/feature-a\n", stderr: "" });

    await previousTmuxSession();

    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "display-message",
      "-p",
      "#{client_last_session}",
    ]);
  });

  describe("when the client has a previous session", () => {
    it("returns its name", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "orc/feature-a\n", stderr: "" });
      expect(await previousTmuxSession()).toBe("orc/feature-a");
    });
  });

  describe("when the client has no previous session", () => {
    it("returns null", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "\n", stderr: "" });
      expect(await previousTmuxSession()).toBeNull();
    });
  });
});

describe("createTmuxSessionUnlessExists", () => {
  describe("when the session already exists", () => {
    it("does not create a new session", async () => {
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await createTmuxSessionUnlessExists("orc", "orc --tui");

      expect(runCommandMock).toHaveBeenCalledTimes(1);
      expect(runCommandMock).toHaveBeenCalledWith([
        "tmux",
        "-L",
        "orc",
        "has-session",
        "-t",
        "orc",
      ]);
    });
  });

  describe("when the session does not exist", () => {
    it("creates it, forwarding the command and options", async () => {
      runCommandMock.mockResolvedValueOnce({
        exitCode: 1,
        stdout: "",
        stderr: "can't find session: orc\n",
      });
      runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

      await createTmuxSessionUnlessExists("orc", "orc --tui", { statusBar: false });

      expect(runCommandMock).toHaveBeenCalledWith([
        "tmux",
        "-L",
        "orc",
        "new-session",
        "-d",
        "-s",
        "orc",
        "orc --tui",
        ";",
        "set-option",
        "-t",
        "orc",
        "status",
        "off",
      ]);
    });
  });
});

describe("detachTmuxClient", () => {
  it("invokes `tmux detach-client` against the orc server", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });
    await detachTmuxClient();
    expect(runCommandMock).toHaveBeenCalledWith(["tmux", "-L", "orc", "detach-client"]);
  });
});

describe("killTmuxSession", () => {
  it("invokes `tmux kill-session` against the orc server", async () => {
    runCommandMock.mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" });

    await killTmuxSession("orc/feature-a");

    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "kill-session",
      "-t",
      "orc/feature-a",
    ]);
  });

  describe("when tmux fails", () => {
    it("throws an error with the stderr message", () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "can't find session: orc/feature-a\n",
      });

      expect(killTmuxSession("orc/feature-a")).rejects.toThrowError(/can't find session/);
    });
  });
});

describe("sessionId", () => {
  it("invokes `tmux display-message` against the orc server for the given pane", async () => {
    runCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "test-project:feature-a\n",
      stderr: "",
    });

    await sessionId("%5");

    expect(runCommandMock).toHaveBeenCalledWith([
      "tmux",
      "-L",
      "orc",
      "display-message",
      "-p",
      "-t",
      "%5",
      "#S",
    ]);
  });

  it("returns the trimmed session name", async () => {
    runCommandMock.mockResolvedValue({
      exitCode: 0,
      stdout: "test-project:feature-a\n",
      stderr: "",
    });

    expect(await sessionId("%5")).toBe("test-project:feature-a");
  });

  describe("when tmux fails", () => {
    it("throws an error with the stderr message", () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "can't find pane: %5\n",
      });

      expect(sessionId("%5")).rejects.toThrowError(/can't find pane/);
    });
  });
});

describe("listTmuxPanes", () => {
  describe("when the orc tmux server is not running", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "no server running on /tmp/tmux-501/orc\n",
      });

      expect(await listTmuxPanes()).toEqual([]);
    });
  });

  describe("when the orc socket does not exist", () => {
    it("returns an empty array", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "error connecting to /private/tmp/tmux-501/orc (No such file or directory)\n",
      });

      expect(await listTmuxPanes()).toEqual([]);
    });
  });

  describe("when there are panes", () => {
    it("invokes `tmux list-panes -a` against the orc server", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "orc/feature-a\t%1\tnvim\n",
        stderr: "",
      });

      await listTmuxPanes();

      expect(runCommandMock).toHaveBeenCalledWith([
        "tmux",
        "-L",
        "orc",
        "list-panes",
        "-a",
        "-F",
        "#{session_name}\t#{pane_id}\t#{pane_title}",
      ]);
    });

    it("returns an array of parsed pane objects", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "orc/feature-a\t%1\tnvim\norc/feature-a\t%2\t⠂ Working on something\n",
        stderr: "",
      });

      expect(await listTmuxPanes()).toEqual([
        { sessionId: "orc/feature-a", paneId: "%1", paneTitle: "nvim" },
        { sessionId: "orc/feature-a", paneId: "%2", paneTitle: "⠂ Working on something" },
      ]);
    });
  });

  describe("when a pane belongs to a foreign session on the orc socket", () => {
    it("skips that pane", async () => {
      runCommandMock.mockResolvedValue({
        exitCode: 0,
        stdout: "foreign-session\t%1\tnvim\norc/feature-a\t%2\tclaude\n",
        stderr: "",
      });

      expect(await listTmuxPanes()).toEqual([
        { sessionId: "orc/feature-a", paneId: "%2", paneTitle: "claude" },
      ]);
    });
  });

  describe("when tmux exits with an unexpected error", () => {
    it("throws an error", () => {
      runCommandMock.mockResolvedValue({
        exitCode: 1,
        stdout: "",
        stderr: "some other tmux error\n",
      });

      expect(listTmuxPanes()).rejects.toThrowError(/some other tmux error/);
    });
  });
});
