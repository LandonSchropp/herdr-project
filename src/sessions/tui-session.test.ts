import { stubEnv } from "../../test/helpers/env.ts";
import { TUI_SESSION, closeTuiSession, shouldRenderTui, startTuiSession } from "./tui-session.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const createTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const switchTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const attachTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const isInsideOrcTmuxSessionMock = mock((): boolean => false);
const currentTmuxSessionMock = mock((): Promise<string | null> => Promise.resolve(null));
const hasTmuxSessionMock = mock((): Promise<boolean> => Promise.resolve(false));
const killTmuxSessionMock = mock((): Promise<void> => Promise.resolve());
const setLastSessionMock = mock((): Promise<void> => Promise.resolve());
const removeLastSessionMock = mock((): Promise<void> => Promise.resolve());

await mock.module("../commands/tmux.ts", () => ({
  createTmuxSession: createTmuxSessionMock,
  switchTmuxSession: switchTmuxSessionMock,
  attachTmuxSession: attachTmuxSessionMock,
  isInsideOrcTmuxSession: isInsideOrcTmuxSessionMock,
  currentTmuxSession: currentTmuxSessionMock,
  hasTmuxSession: hasTmuxSessionMock,
  killTmuxSession: killTmuxSessionMock,
}));

await mock.module("./last-session.ts", () => ({
  setLastSession: setLastSessionMock,
  removeLastSession: removeLastSessionMock,
}));

beforeEach(() => {
  isInsideOrcTmuxSessionMock.mockReturnValue(false);
  hasTmuxSessionMock.mockReturnValue(Promise.resolve(false));
  currentTmuxSessionMock.mockReturnValue(Promise.resolve(null));
});

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

describe("closeTuiSession", () => {
  describe("when a TUI session is running", () => {
    it("kills it", async () => {
      hasTmuxSessionMock.mockReturnValue(Promise.resolve(true));

      await closeTuiSession();

      expect(killTmuxSessionMock).toHaveBeenCalledWith(TUI_SESSION);
    });
  });

  describe("when no TUI session is running", () => {
    it("does not kill anything", async () => {
      hasTmuxSessionMock.mockReturnValue(Promise.resolve(false));

      await closeTuiSession();

      expect(killTmuxSessionMock).not.toHaveBeenCalled();
    });
  });
});

describe("startTuiSession", () => {
  it("creates a fresh TUI session with its status bar hidden", async () => {
    await startTuiSession();

    expect(createTmuxSessionMock).toHaveBeenCalledWith(
      TUI_SESSION,
      expect.stringContaining("ORC_INTERNAL_RENDER_TUI=1"),
      { statusBar: false },
    );
  });

  describe("when a stale TUI session is still around", () => {
    it("closes it before creating a fresh one", async () => {
      hasTmuxSessionMock.mockReturnValue(Promise.resolve(true));

      await startTuiSession();

      expect(killTmuxSessionMock).toHaveBeenCalledWith(TUI_SESSION);
    });
  });

  describe("when inside an orc tmux session", () => {
    beforeEach(async () => {
      isInsideOrcTmuxSessionMock.mockReturnValue(true);
      currentTmuxSessionMock.mockReturnValue(Promise.resolve("project/came-from"));
      await startTuiSession();
    });

    it("switches the client to the TUI session", () => {
      expect(switchTmuxSessionMock).toHaveBeenCalledWith(TUI_SESSION);
    });

    it("records the session it came from as the last session", () => {
      expect(setLastSessionMock).toHaveBeenCalledWith("project/came-from");
    });
  });

  describe("when not inside an orc tmux session", () => {
    beforeEach(async () => {
      isInsideOrcTmuxSessionMock.mockReturnValue(false);
      await startTuiSession();
    });

    it("attaches the terminal to the TUI session", () => {
      expect(attachTmuxSessionMock).toHaveBeenCalledWith(TUI_SESSION);
    });

    it("clears the last session so it opens on the first session", () => {
      expect(removeLastSessionMock).toHaveBeenCalled();
    });
  });
});
