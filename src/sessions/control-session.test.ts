import { stubEnv } from "../../test/helpers/env.ts";
import {
  CONTROL_SESSION,
  attachOrSwitchToControlSession,
  shouldRenderTui,
} from "./control-session.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const createTmuxSessionUnlessExistsMock = mock((): Promise<void> => Promise.resolve());
const switchTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const attachTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const isInsideOrcTmuxSessionMock = mock((): boolean => false);
const currentTmuxSessionMock = mock((): Promise<string | null> => Promise.resolve(null));
const setLastSessionMock = mock((): Promise<void> => Promise.resolve());

await mock.module("../commands/tmux.ts", () => ({
  createTmuxSessionUnlessExists: createTmuxSessionUnlessExistsMock,
  switchTmuxSession: switchTmuxSessionMock,
  attachTmuxSession: attachTmuxSessionMock,
  isInsideOrcTmuxSession: isInsideOrcTmuxSessionMock,
  currentTmuxSession: currentTmuxSessionMock,
}));

await mock.module("./last-session.ts", () => ({
  setLastSession: setLastSessionMock,
}));

describe("shouldRenderTui", () => {
  describe("when the render-TUI flag is set", () => {
    it("returns true", () => {
      stubEnv("ORC_INTERNAL_RENDER_TUI", "1");
      expect(shouldRenderTui()).toBe(true);
    });
  });

  describe("when the render-TUI flag is not set", () => {
    it("returns false", () => {
      stubEnv("ORC_INTERNAL_RENDER_TUI", undefined);
      expect(shouldRenderTui()).toBe(false);
    });
  });
});

describe("attachOrSwitchToControlSession", () => {
  it("runs the TUI in the control session with its status bar hidden", async () => {
    await attachOrSwitchToControlSession();

    expect(createTmuxSessionUnlessExistsMock).toHaveBeenCalledWith(
      CONTROL_SESSION,
      expect.stringContaining("ORC_INTERNAL_RENDER_TUI=1"),
      { statusBar: false },
    );
  });

  describe("when inside an orc tmux session", () => {
    beforeEach(async () => {
      isInsideOrcTmuxSessionMock.mockReturnValue(true);
      currentTmuxSessionMock.mockReturnValue(Promise.resolve("project/came-from"));
      setLastSessionMock.mockClear();
      await attachOrSwitchToControlSession();
    });

    it("switches the client to the control session", () => {
      expect(switchTmuxSessionMock).toHaveBeenCalledWith(CONTROL_SESSION);
    });

    it("records the session it came from as the last session", () => {
      expect(setLastSessionMock).toHaveBeenCalledWith("project/came-from");
    });
  });

  describe("when not inside an orc tmux session", () => {
    beforeEach(async () => {
      isInsideOrcTmuxSessionMock.mockReturnValue(false);
      await attachOrSwitchToControlSession();
    });

    it("attaches the terminal to the control session", () => {
      expect(attachTmuxSessionMock).toHaveBeenCalledWith(CONTROL_SESSION);
    });
  });
});
