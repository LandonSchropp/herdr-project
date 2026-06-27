import { stubEnv } from "../../test/helpers/env.ts";
import { getCallerSession } from "./caller-session.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const isInsideOrcTmuxSessionMock = mock((): boolean => true);
const sessionIdMock = mock((): Promise<string> => Promise.resolve("orc/feature-a"));

await mock.module("../commands/tmux.ts", () => ({
  isInsideOrcTmuxSession: isInsideOrcTmuxSessionMock,
  sessionId: sessionIdMock,
}));

describe("getCallerSession", () => {
  describe("when the process is inside an orc session", () => {
    beforeEach(() => {
      isInsideOrcTmuxSessionMock.mockReturnValue(true);
      stubEnv("TMUX_PANE", "%5");
      sessionIdMock.mockResolvedValue("orc/feature-a");
    });

    it("returns the project and session for the caller's pane", async () => {
      expect(await getCallerSession()).toEqual(["orc", "feature-a"]);
    });

    it("resolves the session from the pane in the environment", async () => {
      await getCallerSession();
      expect(sessionIdMock).toHaveBeenCalledWith("%5");
    });
  });

  describe("when the process is not inside an orc session", () => {
    beforeEach(() => {
      isInsideOrcTmuxSessionMock.mockReturnValue(false);
      stubEnv("TMUX_PANE", "%5");
    });

    it("returns null", async () => {
      expect(await getCallerSession()).toBeNull();
    });
  });

  describe("when the environment has no tmux pane", () => {
    beforeEach(() => {
      isInsideOrcTmuxSessionMock.mockReturnValue(true);
      stubEnv("TMUX_PANE", undefined);
    });

    it("returns null", async () => {
      expect(await getCallerSession()).toBeNull();
    });
  });

  describe("when the pane belongs to a session not in project/session form", () => {
    beforeEach(() => {
      isInsideOrcTmuxSessionMock.mockReturnValue(true);
      stubEnv("TMUX_PANE", "%5");
      sessionIdMock.mockResolvedValue("scratch");
    });

    it("returns null", async () => {
      expect(await getCallerSession()).toBeNull();
    });
  });
});
