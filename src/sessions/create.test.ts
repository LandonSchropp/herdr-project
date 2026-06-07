import { projectSourceFactory } from "../../test/factories/project-source.ts";
import { createSession } from "./create.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { homedir } from "node:os";

const startTmuxinatorProjectMock = mock((): Promise<void> => Promise.resolve());
const defaultBranchMock = mock((): Promise<string | null> => Promise.resolve("main"));
const branchExistsMock = mock((): Promise<boolean> => Promise.resolve(false));
const worktreeExistsMock = mock((): Promise<boolean> => Promise.resolve(false));
const addWorktreeMock = mock((): Promise<void> => Promise.resolve());
const switchSessionMock = mock((): Promise<void> => Promise.resolve());
const mkdirSpy = mock((): Promise<string | undefined> => Promise.resolve(undefined));
const writeSessionFileMock = mock((): Promise<void> => Promise.resolve());
const sessionFileExistsMock = mock((): Promise<boolean> => Promise.resolve(false));
const tmuxinatorProjectExistsMock = mock((): Promise<boolean> => Promise.resolve(true));

await mock.module("../commands/tmuxinator.ts", () => ({
  startTmuxinatorProject: startTmuxinatorProjectMock,
  tmuxinatorProjectExists: tmuxinatorProjectExistsMock,
}));

await mock.module("../commands/git.ts", () => ({
  defaultBranch: defaultBranchMock,
  branchExists: branchExistsMock,
  worktreeExists: worktreeExistsMock,
  addWorktree: addWorktreeMock,
}));

await mock.module("./switch.ts", () => ({
  switchSession: switchSessionMock,
}));

await mock.module("node:fs/promises", () => ({
  mkdir: mkdirSpy,
}));

await mock.module("./session-file.ts", () => ({
  writeSessionFile: writeSessionFileMock,
  sessionFileExists: sessionFileExistsMock,
}));

const repositoryRoot = "/repos/test-project";
const worktreeParent = `${homedir()}/.cache/orc/worktrees/test-project`;
const worktreePath = `${worktreeParent}/feature-a`;
const source = projectSourceFactory.build({ name: "test-project", repositoryRoot });

describe("createSession", () => {
  beforeEach(() => {
    tmuxinatorProjectExistsMock.mockResolvedValue(true);
  });

  describe('when the session is named "main"', () => {
    beforeEach(async () => {
      await createSession(source, "main");
    });

    it("does not look up the default branch", () => {
      expect(defaultBranchMock).not.toHaveBeenCalled();
    });

    it("does not add a Git worktree", () => {
      expect(addWorktreeMock).not.toHaveBeenCalled();
    });

    it("starts the tmuxinator project at the project root", () => {
      expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
        "test-project",
        "main",
        repositoryRoot,
      );
    });

    it("switches to the new session", () => {
      expect(switchSessionMock).toHaveBeenCalledWith("test-project", "main");
    });

    it("writes a session file for the session", () => {
      expect(writeSessionFileMock).toHaveBeenCalledWith(
        expect.objectContaining({
          project: "test-project",
          session: "main",
          id: "test-project/main",
          kind: "tmuxinator",
          repositoryRoot: "/repos/test-project",
        }),
      );
    });
  });

  describe("when a session file already exists", () => {
    beforeEach(async () => {
      sessionFileExistsMock.mockResolvedValue(true);
      await createSession(source, "main");
    });

    it("does not overwrite the existing session file", () => {
      expect(writeSessionFileMock).not.toHaveBeenCalled();
    });
  });

  describe("when the tmuxinator project's config no longer exists", () => {
    beforeEach(async () => {
      tmuxinatorProjectExistsMock.mockResolvedValue(false);
      await createSession(source, "main");
    });

    it("starts the project using the default template", () => {
      expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
        "test-project",
        "main",
        repositoryRoot,
        "default",
      );
    });
  });

  describe("when the source is a directory project", () => {
    const directorySource = projectSourceFactory.build({
      kind: "directory",
      name: "test-project",
      repositoryRoot,
    });

    describe('when the session is named "main"', () => {
      beforeEach(async () => {
        await createSession(directorySource, "main");
      });

      it("starts the project at the root using the default template", () => {
        expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
          "test-project",
          "main",
          repositoryRoot,
          "default",
        );
      });

      it("switches to the new session", () => {
        expect(switchSessionMock).toHaveBeenCalledWith("test-project", "main");
      });
    });

    describe('when the session is not named "main"', () => {
      beforeEach(async () => {
        worktreeExistsMock.mockResolvedValue(true);
        await createSession(directorySource, "feature-a");
      });

      it("starts the project at the worktree using the default template", () => {
        expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
          "test-project",
          "feature-a",
          worktreePath,
          "default",
        );
      });
    });
  });

  describe('when the session is not named "main"', () => {
    describe("when the worktree does not yet exist", () => {
      beforeEach(() => {
        worktreeExistsMock.mockResolvedValue(false);
      });

      describe("when the branch does not yet exist", () => {
        beforeEach(() => {
          branchExistsMock.mockResolvedValue(false);
        });

        describe("when the default branch can be determined", () => {
          beforeEach(async () => {
            defaultBranchMock.mockResolvedValue("main");
            await createSession(source, "feature-a");
          });

          it("creates the worktree parent directory", () => {
            expect(mkdirSpy).toHaveBeenCalledWith(worktreeParent, { recursive: true });
          });

          it("adds a Git worktree with a new branch from the default branch", () => {
            expect(addWorktreeMock).toHaveBeenCalledWith(
              repositoryRoot,
              worktreePath,
              "feature-a",
              "main",
            );
          });

          it("starts the tmuxinator project with the worktree as the root", () => {
            expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
              "test-project",
              "feature-a",
              worktreePath,
            );
          });

          it("switches to the new session", () => {
            expect(switchSessionMock).toHaveBeenCalledWith("test-project", "feature-a");
          });
        });

        describe("when the default branch cannot be determined", () => {
          it("throws an error", () => {
            defaultBranchMock.mockResolvedValue(null);
            expect(createSession(source, "feature-a")).rejects.toThrow(/default branch/i);
          });
        });
      });

      describe("when the branch already exists", () => {
        beforeEach(async () => {
          branchExistsMock.mockResolvedValue(true);
          await createSession(source, "feature-a");
        });

        it("creates the worktree parent directory", () => {
          expect(mkdirSpy).toHaveBeenCalledWith(worktreeParent, { recursive: true });
        });

        it("checks out the existing branch in the worktree", () => {
          expect(addWorktreeMock).toHaveBeenCalledWith(repositoryRoot, worktreePath, "feature-a");
        });

        it("does not look up the default branch", () => {
          expect(defaultBranchMock).not.toHaveBeenCalled();
        });

        it("starts the tmuxinator project with the worktree as the root", () => {
          expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
            "test-project",
            "feature-a",
            worktreePath,
          );
        });

        it("switches to the session", () => {
          expect(switchSessionMock).toHaveBeenCalledWith("test-project", "feature-a");
        });
      });
    });

    describe("when the worktree already exists", () => {
      beforeEach(async () => {
        worktreeExistsMock.mockResolvedValue(true);
        await createSession(source, "feature-a");
      });

      it("does not create the worktree parent directory", () => {
        expect(mkdirSpy).not.toHaveBeenCalled();
      });

      it("does not add a Git worktree", () => {
        expect(addWorktreeMock).not.toHaveBeenCalled();
      });

      it("does not check whether the branch exists", () => {
        expect(branchExistsMock).not.toHaveBeenCalled();
      });

      it("does not look up the default branch", () => {
        expect(defaultBranchMock).not.toHaveBeenCalled();
      });

      it("starts the tmuxinator project with the existing worktree as the root", () => {
        expect(startTmuxinatorProjectMock).toHaveBeenCalledWith(
          "test-project",
          "feature-a",
          worktreePath,
        );
      });

      it("switches to the session", () => {
        expect(switchSessionMock).toHaveBeenCalledWith("test-project", "feature-a");
      });
    });
  });
});
