import { projectFactory } from "../../../test/factories/project.ts";
import { storeFactory } from "../../../test/factories/store.ts";
import * as storeModule from "../state/store.tsx";
import { useSessionListKeybindings } from "./use-session-list-keybindings.ts";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as ink from "ink";
import { render } from "ink-testing-library";

const createOrSwitchSessionMock = mock(() => Promise.resolve());

await mock.module("../../sessions/create-or-switch-session.ts", () => ({
  createOrSwitchSession: createOrSwitchSessionMock,
}));

const previousTmuxSessionMock = mock((): Promise<string | null> => Promise.resolve(null));
const switchTmuxSessionMock = mock((): Promise<void> => Promise.resolve());

await mock.module("../../commands/tmux.ts", () => ({
  previousTmuxSession: previousTmuxSessionMock,
  switchTmuxSession: switchTmuxSessionMock,
}));

const exit = mock(() => {});

/** Mounts `useSessionListKeybindings` so the tests can send it key presses. */
function Harness() {
  useSessionListKeybindings();
  return null;
}

beforeEach(() => {
  previousTmuxSessionMock.mockResolvedValue(null);
  spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build());
  spyOn(ink, "useApp").mockReturnValue({ exit, waitUntilRenderFlush: () => Promise.resolve() });
});

describe("useSessionListKeybindings", () => {
  describe("when q is pressed", () => {
    describe("and there is a previous session", () => {
      it("switches to it and exits so the TUI session is torn down", async () => {
        previousTmuxSessionMock.mockResolvedValue("orc/a");

        const { stdin } = render(<Harness />);

        stdin.write("q");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(switchTmuxSessionMock).toHaveBeenCalledWith("orc/a");
        expect(exit).toHaveBeenCalled();
      });
    });

    describe("and there is no previous session", () => {
      it("exits the app", async () => {
        previousTmuxSessionMock.mockResolvedValue(null);

        const { stdin } = render(<Harness />);

        stdin.write("q");
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(exit).toHaveBeenCalled();
      });
    });
  });

  describe("when escape is pressed and there is no previous session", () => {
    it("exits the app", async () => {
      const { stdin } = render(<Harness />);

      // Ink holds a lone escape for ~20ms to disambiguate it from an escape sequence before
      // flushing it as the escape key, so wait past that delay.
      stdin.write(String.fromCharCode(27));
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(exit).toHaveBeenCalled();
    });
  });

  describe("when another key is pressed", () => {
    it("stays open", () => {
      const { stdin } = render(<Harness />);

      stdin.write("x");

      expect(exit).not.toHaveBeenCalled();
    });
  });

  describe("when the up arrow or k is pressed", () => {
    it("moves the selection up", () => {
      const moveUp = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build({ moveUp }));

      const { stdin } = render(<Harness />);

      stdin.write(String.fromCharCode(27) + "[A");
      stdin.write("k");

      expect(moveUp).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the down arrow or j is pressed", () => {
    it("moves the selection down", () => {
      const moveDown = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build({ moveDown }));

      const { stdin } = render(<Harness />);

      stdin.write(String.fromCharCode(27) + "[B");
      stdin.write("j");

      expect(moveDown).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the left arrow or h is pressed", () => {
    it("moves the selection left", () => {
      const moveLeft = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build({ moveLeft }));

      const { stdin } = render(<Harness />);

      stdin.write(String.fromCharCode(27) + "[D");
      stdin.write("h");

      expect(moveLeft).toHaveBeenCalledTimes(2);
    });
  });

  describe("when the right arrow or l is pressed", () => {
    it("moves the selection right", () => {
      const moveRight = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build({ moveRight }));

      const { stdin } = render(<Harness />);

      stdin.write(String.fromCharCode(27) + "[C");
      stdin.write("l");

      expect(moveRight).toHaveBeenCalledTimes(2);
    });
  });

  describe("when enter is pressed and a session is selected", () => {
    it("attaches to that session", async () => {
      const project = projectFactory.build(
        { project: "orc" },
        { transient: { sessions: ["tui"] } },
      );
      const session = project.sessions[0];
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ selectedSessionId: session.id, projects: [project] }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createOrSwitchSessionMock).toHaveBeenCalledWith(session);
      expect(exit).toHaveBeenCalled();
    });
  });

  describe("when a is pressed and a session is selected", () => {
    it("attaches to that session", async () => {
      const project = projectFactory.build(
        { project: "orc" },
        { transient: { sessions: ["tui"] } },
      );
      const session = project.sessions[0];
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ selectedSessionId: session.id, projects: [project] }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("a");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createOrSwitchSessionMock).toHaveBeenCalledWith(session);
      expect(exit).toHaveBeenCalled();
    });
  });

  describe("when enter is pressed without a selected session", () => {
    it("does nothing", async () => {
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ selectedSessionId: null }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(createOrSwitchSessionMock).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    });
  });

  describe("when n is pressed", () => {
    it("opens the project picker", () => {
      const selectProject = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build({ selectProject }));

      const { stdin } = render(<Harness />);

      stdin.write("n");

      expect(selectProject).toHaveBeenCalled();
    });
  });

  describe("when d is pressed and a session is selected", () => {
    it("opens the delete confirmation modal", () => {
      const confirmDelete = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ selectedSessionId: "orc/tui", confirmDelete }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("d");

      expect(confirmDelete).toHaveBeenCalled();
    });
  });

  describe("when d is pressed and no session is selected", () => {
    it("does nothing", () => {
      const confirmDelete = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ selectedSessionId: null, confirmDelete }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("d");

      expect(confirmDelete).not.toHaveBeenCalled();
    });
  });

  describe("when a modal is open", () => {
    it("ignores key presses", () => {
      const moveUp = mock(() => {});
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({ moveUp, activeModal: { type: "delete" } }),
      );

      const { stdin } = render(<Harness />);

      stdin.write("q");
      stdin.write("k");

      expect(exit).not.toHaveBeenCalled();
      expect(moveUp).not.toHaveBeenCalled();
    });
  });
});
