import { previousTmuxSession, switchTmuxSession } from "../../commands/tmux.ts";
import { createOrSwitchSession } from "../../sessions/create-or-switch-session.ts";
import { findSession } from "../state/find-session.ts";
import { useStore } from "../state/store.tsx";
import { useApp, useInput } from "ink";

/**
 * Handles every key press in the session list view: `q` or escape returns to the previous session
 * (quitting when there is none), the arrow keys and their vim equivalents (`k`/up, `j`/down,
 * `h`/left, `l`/right) move the selected session, `enter` or `a` attaches to the selected session
 * (recreating it first when it is stopped), `n` opens the project picker to start a new session,
 * and `d` opens the delete-confirmation modal when a session is selected. Stays silent while a
 * modal is open so the modal's own `useInput` block owns input.
 */
export function useSessionListKeybindings() {
  const { exit } = useApp();
  const {
    activeModal,
    selectedSessionId,
    projects,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    confirmDelete,
    selectProject,
  } = useStore();

  /** Attaches to the selected session, recreating it first when it is stopped. */
  function attach() {
    const session = findSession(projects, selectedSessionId);
    if (session) void createOrSwitchSession(session);
  }

  /**
   * Leaves the session list: switches back to the session the client came from, or exits the TUI
   * when there is none. Switching back leaves the TUI session alive in the background.
   */
  async function quit() {
    const previous = await previousTmuxSession();
    if (previous) await switchTmuxSession(previous);
    else exit();
  }

  useInput(
    (input, key) => {
      if (input === "q" || key.escape) {
        void quit();
      } else if (key.upArrow || input === "k") {
        moveUp();
      } else if (key.downArrow || input === "j") {
        moveDown();
      } else if (key.leftArrow || input === "h") {
        moveLeft();
      } else if (key.rightArrow || input === "l") {
        moveRight();
      } else if (input === "n") {
        selectProject();
      } else if (input === "d" && selectedSessionId !== null) {
        confirmDelete();
      } else if (input === "a" || key.return) {
        attach();
      }
    },
    { isActive: activeModal === null },
  );
}
