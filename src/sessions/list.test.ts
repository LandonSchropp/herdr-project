import { paneFactory } from "../../test/factories/pane.ts";
import { sessionInfoFactory } from "../../test/factories/session-info.ts";
import { tmuxSessionFactory } from "../../test/factories/tmux-session.ts";
import type { AgentState, SessionInfo, TmuxPane, TmuxSession } from "../types.ts";
import { listSessions } from "./list.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const listSessionFilesMock = mock((): Promise<SessionInfo[]> => Promise.resolve([]));
const listTmuxSessionsMock = mock((): Promise<TmuxSession[]> => Promise.resolve([]));
const listTmuxPanesMock = mock((): Promise<TmuxPane[]> => Promise.resolve([]));
const readStateFileMock = mock((): Promise<AgentState | null> => Promise.resolve(null));
const existsMock = mock((): Promise<boolean> => Promise.resolve(true));

await mock.module("../commands/tmux.ts", () => ({
  listTmuxSessions: listTmuxSessionsMock,
  listTmuxPanes: listTmuxPanesMock,
}));

await mock.module("./session-file.ts", () => ({
  listSessionFiles: listSessionFilesMock,
}));

await mock.module("./state.ts", () => ({
  readStateFile: readStateFileMock,
}));

await mock.module("../utilities/exists.ts", () => ({
  exists: existsMock,
}));

beforeEach(() => {
  listSessionFilesMock.mockResolvedValue([]);
  listTmuxSessionsMock.mockResolvedValue([]);
  listTmuxPanesMock.mockResolvedValue([]);
  readStateFileMock.mockResolvedValue(null);
  existsMock.mockResolvedValue(true);
});

describe("listSessions", () => {
  describe("when there are no session files", () => {
    it("returns an empty array", async () => {
      expect(await listSessions()).toEqual([]);
    });
  });

  describe("when a session file has a live tmux session", () => {
    beforeEach(() => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({
          project: "orc",
          session: "feature-a",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([
        tmuxSessionFactory.build({ project: "orc", session: "feature-a" }),
      ]);
    });

    it("marks the session running", async () => {
      const [session] = await listSessions();

      expect(session.status).toBe("running");
    });

    it("carries the project info from the session file", async () => {
      const [session] = await listSessions();

      expect(session).toMatchObject({
        kind: "tmuxinator",
        repositoryRoot: "/repos/orc",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });
  });

  describe("when a session file has no live tmux session", () => {
    beforeEach(() => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([]);
    });

    it("marks the session stopped with no agents", async () => {
      const [session] = await listSessions();

      expect(session.status).toBe("stopped");
      expect(session.agents).toEqual([]);
    });
  });

  describe("when a stopped session's worktree has been deleted", () => {
    beforeEach(() => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([]);
      existsMock.mockResolvedValue(false);
    });

    it("marks the session deleted", async () => {
      const [session] = await listSessions();

      expect(session.status).toBe("deleted");
    });
  });

  describe("when a running session's worktree has been deleted", () => {
    beforeEach(() => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([
        tmuxSessionFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      existsMock.mockResolvedValue(false);
    });

    it("marks the session deleted even though tmux is still running it", async () => {
      const [session] = await listSessions();

      expect(session.status).toBe("deleted");
    });
  });

  describe("when the stopped session is the main session", () => {
    beforeEach(() => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "main" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([]);
      existsMock.mockResolvedValue(false);
    });

    it("stays stopped without checking a worktree", async () => {
      const [session] = await listSessions();

      expect(session.status).toBe("stopped");
    });
  });

  describe("when a running session has an agent pane with a state file", () => {
    it("uses the status and start time from the state file", async () => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([
        tmuxSessionFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxPanesMock.mockResolvedValue([
        paneFactory.build({ sessionId: "orc/feature-a", paneId: "%3", paneTitle: "⠂ Working" }),
      ]);
      readStateFileMock.mockResolvedValue({
        status: "Waiting",
        timestamp: "2026-05-17T00:00:00.000Z",
      });

      const [session] = await listSessions();

      expect(session.agents).toEqual([
        { paneId: "%3", status: "Waiting", updatedAt: new Date("2026-05-17T00:00:00.000Z") },
      ]);
    });
  });

  describe("when a running session's agent pane has no state file yet", () => {
    it("defaults the status to Idle", async () => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([
        tmuxSessionFactory.build({ project: "orc", session: "feature-a" }),
      ]);
      listTmuxPanesMock.mockResolvedValue([
        paneFactory.build({ sessionId: "orc/feature-a", paneId: "%3", paneTitle: "✳ Idle" }),
      ]);
      readStateFileMock.mockResolvedValue(null);

      const [session] = await listSessions();

      expect(session.agents).toMatchObject([{ paneId: "%3", status: "Idle" }]);
    });
  });

  describe("when there are multiple running sessions", () => {
    it("assigns each agent pane to the correct session", async () => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
        sessionInfoFactory.build({ project: "orc", session: "feature-b" }),
      ]);
      listTmuxSessionsMock.mockResolvedValue([
        tmuxSessionFactory.build({ project: "orc", session: "feature-a" }),
        tmuxSessionFactory.build({ project: "orc", session: "feature-b" }),
      ]);
      listTmuxPanesMock.mockResolvedValue([
        paneFactory.build({ sessionId: "orc/feature-a", paneId: "%3", paneTitle: "⠂ A" }),
        paneFactory.build({ sessionId: "orc/feature-b", paneId: "%5", paneTitle: "⠂ B" }),
      ]);

      const sessions = await listSessions();

      expect(sessions.find((session) => session.id === "orc/feature-a")?.agents).toMatchObject([
        { paneId: "%3", status: "Idle" },
      ]);
      expect(sessions.find((session) => session.id === "orc/feature-b")?.agents).toMatchObject([
        { paneId: "%5", status: "Idle" },
      ]);
    });
  });

  describe('when the session is named "main"', () => {
    it("runs on the main worktree", async () => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "main" }),
      ]);

      const [session] = await listSessions();

      expect(session.worktree).toBe("main");
    });
  });

  describe('when the session is not named "main"', () => {
    it("runs on a linked worktree", async () => {
      listSessionFilesMock.mockResolvedValue([
        sessionInfoFactory.build({ project: "orc", session: "feature-a" }),
      ]);

      const [session] = await listSessions();

      expect(session.worktree).toBe("linked");
    });
  });
});
