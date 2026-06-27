import { exitSpy, stderrSpy, stdoutSpy } from "../../test/helpers/process.ts";
import { callerSessionCommand } from "./caller-session.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { runCommand } from "citty";

const getCallerSessionMock = mock((): Promise<[string, string] | null> => Promise.resolve(null));

await mock.module("../sessions/caller-session.ts", () => ({
  getCallerSession: getCallerSessionMock,
}));

describe("callerSessionCommand", () => {
  describe("when the command is run inside a session", () => {
    beforeEach(() => {
      getCallerSessionMock.mockResolvedValue(["orc", "feature-a"]);
    });

    it("writes the project and session as a tab-separated row", async () => {
      await runCommand(callerSessionCommand, { rawArgs: [] });
      expect(stdoutSpy).toHaveBeenCalledWith("orc\tfeature-a\n");
    });
  });

  describe("when the command is run outside a session", () => {
    beforeEach(() => {
      getCallerSessionMock.mockResolvedValue(null);
    });

    it("prints an error", async () => {
      await runCommand(callerSessionCommand, { rawArgs: [] });
      expect(stderrSpy).toHaveBeenCalledWith("Not inside an Orc session\n");
    });

    it("exits with code 1", async () => {
      await runCommand(callerSessionCommand, { rawArgs: [] });
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
