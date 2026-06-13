import type { Project, ProjectSource, Session } from "../../types.ts";

/**
 * The modal currently displayed over the TUI, or `null` if none. Variants only carry data that
 * isn't already derivable from the rest of the store (e.g. the picked project before it lands in a
 * primary slot); the delete confirm reads its target from `selectedSessionId`.
 */
export type ActiveModal =
  | { type: "project-picker" }
  | { type: "session-name"; source: ProjectSource }
  | { type: "delete" }
  | null;

export type StoreState = {
  /** The current list of projects, each holding its grouped sessions. */
  projects: Project[];
  /** The id of the currently selected session, or `null` if none. */
  selectedSessionId: string | null;
  /** The number of session cards that fit across the viewport in a single row. */
  numberOfColumns: number;
  /** The width of the left margin outside the leftmost column. */
  leftMargin: number;
  /** The width of the right margin outside the rightmost column. */
  rightMargin: number;
  /** The height of the terminal window, in rows. */
  windowHeight: number;
  /** The preferred column for vertical movement, remembered across up/down moves. */
  lastSelectedColumn: number | null;
  /** How far the project list is scrolled from the top, in rows. */
  scrollOffset: number;
  /** The modal currently displayed over the TUI, or `null` if none. */
  activeModal: ActiveModal;
};

/** Actions for the state reducer. */
export type StoreAction =
  | { type: "SET_SESSIONS"; sessions: Session[] }
  | { type: "SELECT_SESSION"; id: string }
  | { type: "REMOVE_SESSION"; id: string }
  | { type: "SET_WINDOW_SIZE"; windowWidth: number; windowHeight: number }
  | { type: "MOVE_LEFT" }
  | { type: "MOVE_RIGHT" }
  | { type: "MOVE_UP" }
  | { type: "MOVE_DOWN" }
  | { type: "CONFIRM_DELETE" }
  | { type: "SELECT_PROJECT" }
  | { type: "PROMPT_FOR_SESSION"; source: ProjectSource }
  | { type: "CANCEL" };
