import type { SessionInfo } from "../types.ts";
import { deleteSession } from "./delete.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { homedir } from "node:os";

const repositoryRoot = "/repos/test-project";
const worktreePath = `${homedir()}/.cache/orc/worktrees/test-project/feature-a`;

const sessionInfo: SessionInfo = {
  project: "test-project",
  session: "feature-a",
  id: "test-project/feature-a",
  kind: "directory",
  repositoryRoot,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
};

const killTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const worktreeExistsMock = mock((): Promise<boolean> => Promise.resolve(true));
const removeWorktreeMock = mock((): Promise<void> => Promise.resolve());
const removeSessionStateFilesMock = mock((): Promise<void> => Promise.resolve());
const readSessionFileMock = mock((): Promise<SessionInfo | null> => Promise.resolve(sessionInfo));
const removeSessionFileMock = mock((): Promise<void> => Promise.resolve());

await mock.module("../commands/tmux.ts", () => ({
  killTmuxSession: killTmuxSessionMock,
}));

await mock.module("./id.ts", () => ({
  sessionId: (project: string, session: string) => `${project}/${session}`,
}));

await mock.module("../commands/git.ts", () => ({
  worktreeExists: worktreeExistsMock,
  removeWorktree: removeWorktreeMock,
}));

await mock.module("./state.ts", () => ({
  removeSessionStateFiles: removeSessionStateFilesMock,
}));

await mock.module("./session-file.ts", () => ({
  readSessionFile: readSessionFileMock,
  removeSessionFile: removeSessionFileMock,
}));

beforeEach(() => {
  worktreeExistsMock.mockResolvedValue(true);
  readSessionFileMock.mockResolvedValue(sessionInfo);
});

describe("deleteSession", () => {
  describe("when the worktree is registered in git", () => {
    beforeEach(async () => {
      worktreeExistsMock.mockResolvedValue(true);
      await deleteSession("test-project", "feature-a");
    });

    it("resolves the repository from the session file", () => {
      expect(readSessionFileMock).toHaveBeenCalledWith("test-project", "feature-a");
    });

    it("checks whether the worktree is registered in the resolved repository", () => {
      expect(worktreeExistsMock).toHaveBeenCalledWith(repositoryRoot, worktreePath);
    });

    it("removes the worktree from the resolved repository", () => {
      expect(removeWorktreeMock).toHaveBeenCalledWith(repositoryRoot, worktreePath);
    });

    it("kills the tmux session", () => {
      expect(killTmuxSessionMock).toHaveBeenCalledWith("test-project/feature-a");
    });

    it("removes the agent state files for the session", () => {
      expect(removeSessionStateFilesMock).toHaveBeenCalledWith("test-project", "feature-a");
    });

    it("removes the session file", () => {
      expect(removeSessionFileMock).toHaveBeenCalledWith("test-project", "feature-a");
    });

    it("kills the tmux session before removing the worktree", () => {
      expect(killTmuxSessionMock.mock.invocationCallOrder[0]).toBeLessThan(
        removeWorktreeMock.mock.invocationCallOrder[0],
      );
    });
  });

  describe("when the worktree directory is gone but still registered in git", () => {
    beforeEach(async () => {
      worktreeExistsMock.mockResolvedValue(true);
      await deleteSession("test-project", "feature-a");
    });

    it("removes the stale worktree registration from git", () => {
      expect(removeWorktreeMock).toHaveBeenCalledWith(repositoryRoot, worktreePath);
    });
  });

  describe("when the worktree is not registered in git", () => {
    beforeEach(async () => {
      worktreeExistsMock.mockResolvedValue(false);
      await deleteSession("test-project", "feature-a");
    });

    it("does not remove a worktree", () => {
      expect(removeWorktreeMock).not.toHaveBeenCalled();
    });

    it("kills the tmux session", () => {
      expect(killTmuxSessionMock).toHaveBeenCalledWith("test-project/feature-a");
    });

    it("removes the session file", () => {
      expect(removeSessionFileMock).toHaveBeenCalledWith("test-project", "feature-a");
    });
  });

  describe("when the session has no session file", () => {
    beforeEach(async () => {
      readSessionFileMock.mockResolvedValue(null);
      await deleteSession("test-project", "feature-a");
    });

    it("does not look for a worktree", () => {
      expect(worktreeExistsMock).not.toHaveBeenCalled();
    });

    it("does not remove a worktree", () => {
      expect(removeWorktreeMock).not.toHaveBeenCalled();
    });

    it("kills the tmux session", () => {
      expect(killTmuxSessionMock).toHaveBeenCalledWith("test-project/feature-a");
    });

    it("removes the session file", () => {
      expect(removeSessionFileMock).toHaveBeenCalledWith("test-project", "feature-a");
    });
  });
});
