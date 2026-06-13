import type { ProjectSource, Session } from "../../types.ts";
import { computeLayout } from "./compute-layout.ts";
import { findSession } from "./find-session.ts";
import { groupSessionsByProject } from "./group-sessions-by-project.ts";
import * as move from "./move.ts";
import { pickNextSelection } from "./pick-next-selection.ts";
import { scrollOffsetForSelection } from "./scroll-offset-for-selection.ts";
import { sessionColumn } from "./session-column.ts";
import type { StoreAction, StoreState } from "./types.ts";
import { useCallback, useReducer } from "react";

/**
 * Rebuilds the projects, selection, remembered column, and scroll offset for a new set of sessions.
 *
 * @param state The current store state.
 * @param sessions The sessions to display.
 * @returns The new store state reflecting the given sessions.
 */
function withSessions(state: StoreState, sessions: Session[]): StoreState {
  const projects = groupSessionsByProject(sessions);
  const selectedSessionId = pickNextSelection(state.projects, state.selectedSessionId, projects);

  const previousColumn = sessionColumn(state.projects, selectedSessionId, state.numberOfColumns);
  const currentColumn = sessionColumn(projects, selectedSessionId, state.numberOfColumns);

  return {
    ...state,
    projects,
    selectedSessionId,
    // Recompute the remembered column only when the selected session actually shifts columns;
    // otherwise a poll that lands while the cursor sits in a narrow row would clobber the column
    // the user is aiming for.
    lastSelectedColumn: previousColumn === currentColumn ? state.lastSelectedColumn : currentColumn,
    scrollOffset: scrollOffsetForSelection(
      projects,
      selectedSessionId,
      state.numberOfColumns,
      state.scrollOffset,
      state.windowHeight,
    ),
  };
}

/**
 * A pure reducer that applies an action to the store state. Vertical moves and session updates
 * recompute the scroll offset so the selected session's row stays in view; horizontal moves stay
 * within a row and leave it unchanged.
 *
 * @param state The current store state prior to the action update.
 * @param action The action to apply to the state.
 * @returns The new store state after applying the action.
 */
function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "SET_SESSIONS": {
      return withSessions(state, action.sessions);
    }
    case "SELECT_SESSION": {
      // Ignore a request to select a session that no longer exists, leaving the cursor put.
      if (!findSession(state.projects, action.id)) {
        return state;
      }

      return {
        ...state,
        selectedSessionId: action.id,
        lastSelectedColumn: sessionColumn(state.projects, action.id, state.numberOfColumns),
        scrollOffset: scrollOffsetForSelection(
          state.projects,
          action.id,
          state.numberOfColumns,
          state.scrollOffset,
          state.windowHeight,
        ),
      };
    }
    case "REMOVE_SESSION": {
      const sessions = state.projects.flatMap((project) => project.sessions);
      return withSessions(
        state,
        sessions.filter((session) => session.id !== action.id),
      );
    }
    case "SET_WINDOW_SIZE": {
      const layout = computeLayout(action.windowWidth);

      return {
        ...state,
        ...layout,
        windowHeight: action.windowHeight,
        lastSelectedColumn:
          layout.numberOfColumns !== state.numberOfColumns
            ? sessionColumn(state.projects, state.selectedSessionId, layout.numberOfColumns)
            : state.lastSelectedColumn,
        scrollOffset: scrollOffsetForSelection(
          state.projects,
          state.selectedSessionId,
          layout.numberOfColumns,
          state.scrollOffset,
          action.windowHeight,
        ),
      };
    }
    case "MOVE_LEFT": {
      const selectedSessionId = move.moveLeft(
        state.projects,
        state.selectedSessionId,
        state.numberOfColumns,
      );

      return {
        ...state,
        selectedSessionId,
        lastSelectedColumn: sessionColumn(state.projects, selectedSessionId, state.numberOfColumns),
      };
    }
    case "MOVE_RIGHT": {
      const selectedSessionId = move.moveRight(
        state.projects,
        state.selectedSessionId,
        state.numberOfColumns,
      );

      return {
        ...state,
        selectedSessionId,
        lastSelectedColumn: sessionColumn(state.projects, selectedSessionId, state.numberOfColumns),
      };
    }
    case "MOVE_UP": {
      const selectedSessionId = move.moveUp(
        state.projects,
        state.selectedSessionId,
        state.lastSelectedColumn,
        state.numberOfColumns,
      );

      return {
        ...state,
        selectedSessionId,
        scrollOffset: scrollOffsetForSelection(
          state.projects,
          selectedSessionId,
          state.numberOfColumns,
          state.scrollOffset,
          state.windowHeight,
        ),
      };
    }
    case "MOVE_DOWN": {
      const selectedSessionId = move.moveDown(
        state.projects,
        state.selectedSessionId,
        state.lastSelectedColumn,
        state.numberOfColumns,
      );

      return {
        ...state,
        selectedSessionId,
        scrollOffset: scrollOffsetForSelection(
          state.projects,
          selectedSessionId,
          state.numberOfColumns,
          state.scrollOffset,
          state.windowHeight,
        ),
      };
    }
    case "CONFIRM_DELETE": {
      return { ...state, activeModal: { type: "delete" } };
    }
    case "SELECT_PROJECT": {
      return { ...state, activeModal: { type: "project-picker" } };
    }
    case "PROMPT_FOR_SESSION": {
      return { ...state, activeModal: { type: "session-name", source: action.source } };
    }
    case "CANCEL": {
      return { ...state, activeModal: null };
    }
  }
}

/**
 * Provides the store state along with action-dispatching callbacks that update it, including
 * `setWindowSize` for keeping the store's layout and height in sync with resize events. Exported
 * for direct testing; production callers should use `StoreProvider` and `useStore` instead.
 *
 * @param initialWindowWidth The initial width of the terminal window.
 * @param initialWindowHeight The initial height of the terminal window.
 * @param selectedSessionId The session to select initially, used to seed the selection so the first
 *   load lands on it. Falls back to the first session when `null`.
 * @returns An object containing the current store state and functions to update it.
 */
export function useStoreReducer(
  initialWindowWidth: number,
  initialWindowHeight: number,
  selectedSessionId: string | null,
) {
  const [state, dispatch] = useReducer(storeReducer, {
    projects: [],
    selectedSessionId,
    ...computeLayout(initialWindowWidth),
    windowHeight: initialWindowHeight,
    lastSelectedColumn: null,
    scrollOffset: 0,
    activeModal: null,
  });

  const setSessions = useCallback(
    (sessions: Session[]) => {
      dispatch({ type: "SET_SESSIONS", sessions });
    },
    [dispatch],
  );

  const selectSession = useCallback(
    (id: string) => {
      dispatch({ type: "SELECT_SESSION", id });
    },
    [dispatch],
  );

  const removeSession = useCallback(
    (id: string) => {
      dispatch({ type: "REMOVE_SESSION", id });
    },
    [dispatch],
  );

  const setWindowSize = useCallback(
    (windowWidth: number, windowHeight: number) => {
      dispatch({ type: "SET_WINDOW_SIZE", windowWidth, windowHeight });
    },
    [dispatch],
  );

  const moveLeft = useCallback(() => {
    dispatch({ type: "MOVE_LEFT" });
  }, [dispatch]);

  const moveRight = useCallback(() => {
    dispatch({ type: "MOVE_RIGHT" });
  }, [dispatch]);

  const moveUp = useCallback(() => {
    dispatch({ type: "MOVE_UP" });
  }, [dispatch]);

  const moveDown = useCallback(() => {
    dispatch({ type: "MOVE_DOWN" });
  }, [dispatch]);

  const confirmDelete = useCallback(() => {
    dispatch({ type: "CONFIRM_DELETE" });
  }, [dispatch]);

  const selectProject = useCallback(() => {
    dispatch({ type: "SELECT_PROJECT" });
  }, [dispatch]);

  const promptForSession = useCallback(
    (source: ProjectSource) => {
      dispatch({ type: "PROMPT_FOR_SESSION", source });
    },
    [dispatch],
  );

  const cancel = useCallback(() => {
    dispatch({ type: "CANCEL" });
  }, [dispatch]);

  return {
    ...state,
    setSessions,
    selectSession,
    removeSession,
    setWindowSize,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
    confirmDelete,
    selectProject,
    promptForSession,
    cancel,
  };
}
