import { sessionFactory } from "../../test/factories/session.ts";
import { exitSpy, stderrSpy } from "../../test/helpers/process.ts";
import type { ProjectSource, Session } from "../types.ts";
import { newCommand } from "./new.ts";
import { describe, expect, it, mock } from "bun:test";
import { runCommand } from "citty";

const createSessionMock = mock((): Promise<void> => Promise.resolve());
const findSessionMock = mock((): Promise<Session | null> => Promise.resolve(null));
const findProjectSourceMock = mock<(name: string) => Promise<ProjectSource | null>>(() =>
  Promise.resolve(null),
);

await mock.module("../sessions/create.ts", () => ({
  createSession: createSessionMock,
}));

await mock.module("../sessions/find.ts", () => ({
  findSession: findSessionMock,
}));

await mock.module("../sessions/project-sources.ts", () => ({
  findProjectSource: findProjectSourceMock,
}));

describe("newCommand", () => {
  describe("when the project exists and no session with the same name exists", () => {
    it("creates the session for the matching source", async () => {
      findSessionMock.mockResolvedValue(null);
      findProjectSourceMock.mockResolvedValue({
        kind: "tmuxinator",
        name: "test-project",
        repositoryRoot: "/repos/test-project",
      });

      await runCommand(newCommand, { rawArgs: ["test-project", "feature-a"] });

      expect(findSessionMock).toHaveBeenCalledWith("test-project", "feature-a");
      expect(createSessionMock).toHaveBeenCalledWith(
        { kind: "tmuxinator", name: "test-project", repositoryRoot: "/repos/test-project" },
        "feature-a",
      );
    });
  });

  describe("when the project is not found", () => {
    it("prints an error and exits with code 1 without creating", async () => {
      findSessionMock.mockResolvedValue(null);
      findProjectSourceMock.mockResolvedValue(null);

      await runCommand(newCommand, { rawArgs: ["test-project", "feature-a"] });

      expect(stderrSpy).toHaveBeenCalledWith("Project not found: test-project\n");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("when a session with the same name already exists", () => {
    it("prints an error and exits with code 1 without creating", async () => {
      findSessionMock.mockResolvedValue(
        sessionFactory.build({ project: "test-project", session: "feature-a" }),
      );

      await runCommand(newCommand, { rawArgs: ["test-project", "feature-a"] });

      expect(stderrSpy).toHaveBeenCalledWith("Session already exists: test-project/feature-a\n");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  });
});
