import { projectSourceFactory } from "../../../test/factories/project-source.ts";
import { sessionFactory } from "../../../test/factories/session.ts";
import { useStoreReducer } from "./use-store-reducer.ts";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "bun:test";

GlobalRegistrator.register();

describe("useStoreReducer", () => {
  describe("when first called", () => {
    it("returns an empty projects list", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      expect(result.current.projects).toEqual([]);
    });

    it("returns a null selected session id", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      expect(result.current.selectedSessionId).toBeNull();
    });

    it("returns the layout computed from the initial window width", () => {
      const { result } = renderHook(() => useStoreReducer(122, 30, null));

      expect(result.current.numberOfColumns).toBe(4);
      expect(result.current.leftMargin).toBe(2);
      expect(result.current.rightMargin).toBe(2);
    });

    it("returns the initial window height", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      expect(result.current.windowHeight).toBe(30);
    });

    it("returns a null last selected column", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      expect(result.current.lastSelectedColumn).toBeNull();
    });

    it("returns a null active modal", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      expect(result.current.activeModal).toBeNull();
    });
  });

  describe("when confirmDelete is called", () => {
    it("opens the delete confirmation modal", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.confirmDelete());

      expect(result.current.activeModal).toEqual({ type: "delete" });
    });
  });

  describe("when selectProject is called", () => {
    it("opens the project picker", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.selectProject());

      expect(result.current.activeModal).toEqual({ type: "project-picker" });
    });
  });

  describe("when promptForSession is called", () => {
    it("opens the session-name prompt for the given project", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));
      const source = projectSourceFactory.build({ name: "orc" });

      act(() => result.current.promptForSession(source));

      expect(result.current.activeModal).toEqual({ type: "session-name", source });
    });
  });

  describe("when cancel is called", () => {
    it("clears the active modal", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.confirmDelete());
      act(() => result.current.cancel());

      expect(result.current.activeModal).toBeNull();
    });
  });

  describe("when setSessions is called", () => {
    it("groups the sessions by project", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "notes", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));

      expect(result.current.projects).toEqual([
        { project: "notes", sessions: [b] },
        { project: "orc", sessions: [a] },
      ]);
    });

    describe("when no session is currently selected", () => {
      it("selects the first session", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "notes", session: "b" });

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions([a, b]));

        expect(result.current.selectedSessionId).toBe("notes/b");
      });
    });

    describe("when the store was created with a current session", () => {
      it("selects the current session", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "orc", session: "b" });
        const c = sessionFactory.build({ project: "orc", session: "c" });

        const { result } = renderHook(() => useStoreReducer(100, 30, "orc/c"));

        act(() => result.current.setSessions([a, b, c]));

        expect(result.current.selectedSessionId).toBe("orc/c");
      });
    });

    describe("when the store was created with a current session that is absent", () => {
      it("selects the first session", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "orc", session: "b" });

        const { result } = renderHook(() => useStoreReducer(100, 30, "orc/ghost"));

        act(() => result.current.setSessions([a, b]));

        expect(result.current.selectedSessionId).toBe("orc/a");
      });
    });

    describe("when the previously selected session is still present", () => {
      it("keeps it selected", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "orc", session: "b" });
        const c = sessionFactory.build({ project: "orc", session: "c" });

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions([a, b]));
        act(() => result.current.setSessions([a, b, c]));

        expect(result.current.selectedSessionId).toBe("orc/a");
      });
    });

    describe("when the previously selected session was removed", () => {
      it("picks the next session in the previous order", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "orc", session: "b" });
        const c = sessionFactory.build({ project: "orc", session: "c" });

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions([a, b, c]));
        act(() => result.current.setSessions([b, c]));

        expect(result.current.selectedSessionId).toBe("orc/b");
      });
    });

    describe("when the selected session's column changes", () => {
      it("recomputes the last selected column", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const aa = sessionFactory.build({ project: "orc", session: "aa" });
        const b = sessionFactory.build({ project: "orc", session: "b" });

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions([a, b]));
        act(() => result.current.moveRight());
        act(() => result.current.setSessions([a, aa, b]));

        expect(result.current.lastSelectedColumn).toBe(2);
      });
    });

    describe("when the selected session's column is unchanged", () => {
      it("preserves the last selected column", () => {
        const sessions = [
          sessionFactory.build({ project: "orc", session: "a" }),
          sessionFactory.build({ project: "orc", session: "b" }),
          sessionFactory.build({ project: "orc", session: "c" }),
          sessionFactory.build({ project: "z", session: "solo" }),
        ];

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions(sessions));
        act(() => result.current.moveRight());
        act(() => result.current.moveRight());
        act(() => result.current.moveDown());
        act(() => result.current.setSessions(sessions));

        expect(result.current.lastSelectedColumn).toBe(2);
      });
    });
  });

  describe("when removeSession is called", () => {
    it("removes the session from its project", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.removeSession("orc/a"));

      expect(result.current.projects).toEqual([{ project: "orc", sessions: [b] }]);
    });

    it("moves the selection to the next session", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.removeSession("orc/a"));

      expect(result.current.selectedSessionId).toBe("orc/b");
    });
  });

  describe("when setWindowSize is called", () => {
    it("updates the layout values", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setWindowSize(122, 30));

      expect(result.current.numberOfColumns).toBe(4);
      expect(result.current.leftMargin).toBe(2);
      expect(result.current.rightMargin).toBe(2);
    });

    it("updates the window height", () => {
      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setWindowSize(100, 50));

      expect(result.current.windowHeight).toBe(50);
    });

    describe("when the number of columns changes", () => {
      it("recomputes the last selected column from the current selection", () => {
        const sessions = ["a", "b", "c"].map((session) =>
          sessionFactory.build({ project: "orc", session }),
        );

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions(sessions));
        act(() => result.current.moveRight());
        act(() => result.current.moveRight());
        act(() => result.current.setWindowSize(62, 30));

        expect(result.current.lastSelectedColumn).toBe(0);
      });
    });

    describe("when the number of columns does not change", () => {
      it("leaves the last selected column unchanged", () => {
        const a = sessionFactory.build({ project: "orc", session: "a" });
        const b = sessionFactory.build({ project: "orc", session: "b" });

        const { result } = renderHook(() => useStoreReducer(100, 30, null));

        act(() => result.current.setSessions([a, b]));
        act(() => result.current.moveRight());
        act(() => result.current.setWindowSize(96, 30));

        expect(result.current.lastSelectedColumn).toBe(1);
      });
    });
  });

  describe("when moveLeft is called", () => {
    it("moves the selection to the previous session in the same row", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.moveLeft());
      act(() => result.current.moveLeft());

      expect(result.current.selectedSessionId).toBe("orc/a");
    });

    it("sets the last selected column to the new column", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.moveRight());
      act(() => result.current.moveLeft());

      expect(result.current.lastSelectedColumn).toBe(0);
    });
  });

  describe("when moveRight is called", () => {
    it("moves the selection to the next session in the same row", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.moveRight());

      expect(result.current.selectedSessionId).toBe("orc/b");
    });

    it("sets the last selected column to the new column", () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions([a, b]));
      act(() => result.current.moveRight());

      expect(result.current.lastSelectedColumn).toBe(1);
    });
  });

  describe("when moveDown is called", () => {
    it("moves the selection to the next row in the same project", () => {
      const sessions = ["a", "b", "c", "d"].map((session) =>
        sessionFactory.build({ project: "orc", session }),
      );

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions(sessions));
      act(() => result.current.moveDown());

      expect(result.current.selectedSessionId).toBe("orc/d");
    });

    it("leaves the last selected column unchanged", () => {
      const sessions = ["a", "b", "c", "d"].map((session) =>
        sessionFactory.build({ project: "orc", session }),
      );

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions(sessions));
      act(() => result.current.moveRight());
      act(() => result.current.moveDown());

      expect(result.current.lastSelectedColumn).toBe(1);
    });
  });

  describe("when moveUp is called", () => {
    it("moves the selection to the previous row in the same project", () => {
      const sessions = ["a", "b", "c", "d"].map((session) =>
        sessionFactory.build({ project: "orc", session }),
      );

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions(sessions));
      act(() => result.current.moveDown());
      act(() => result.current.moveUp());

      expect(result.current.selectedSessionId).toBe("orc/a");
    });

    it("leaves the last selected column unchanged", () => {
      const sessions = ["a", "b", "c", "d"].map((session) =>
        sessionFactory.build({ project: "orc", session }),
      );

      const { result } = renderHook(() => useStoreReducer(100, 30, null));

      act(() => result.current.setSessions(sessions));
      act(() => result.current.moveRight());
      act(() => result.current.moveDown());
      act(() => result.current.moveUp());

      expect(result.current.lastSelectedColumn).toBe(1);
    });
  });
});
