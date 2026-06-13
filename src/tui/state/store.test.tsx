import { sessionFactory } from "../../../test/factories/session.ts";
import * as lastSessionModule from "../../sessions/last-session.ts";
import * as listSessionsModule from "../../sessions/list.ts";
import { StoreProvider, useStore } from "./store.tsx";
import * as useWindowSizeModule from "./use-window-size.ts";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { ReactNode } from "react";

GlobalRegistrator.register();

beforeEach(() => {
  spyOn(useWindowSizeModule, "useWindowSize").mockReturnValue({ columns: 100, rows: 30 });
  spyOn(listSessionsModule, "listSessions").mockResolvedValue([]);
  spyOn(lastSessionModule, "readLastSession").mockResolvedValue(null);
  spyOn(lastSessionModule, "removeLastSession").mockResolvedValue();
});

/**
 * Wraps children in a `StoreProvider` so `useStore` has a store to read.
 *
 * @returns The children wrapped in a `StoreProvider`.
 */
function wrapper({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

describe("useStore", () => {
  describe("when used outside a StoreProvider", () => {
    it("throws an error", () => {
      expect(() => renderHook(() => useStore())).toThrow();
    });
  });

  describe("when used inside a StoreProvider", () => {
    it("returns the store's state", async () => {
      const { result } = renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          projects: [],
          selectedSessionId: null,
          numberOfColumns: 3,
        });
      });
    });

    it("returns the store actions", async () => {
      const { result } = renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(typeof result.current.setSessions).toBe("function");
        expect(typeof result.current.setWindowSize).toBe("function");
      });
    });

    it("populates the store with the polled sessions", async () => {
      const session = sessionFactory.build({ project: "orc", session: "a" });
      spyOn(listSessionsModule, "listSessions").mockResolvedValue([session]);

      const { result } = renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(result.current.projects).toEqual([{ project: "orc", sessions: [session] }]);
      });
    });

    it("seeds the selection with the last session on the first load", async () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });
      spyOn(listSessionsModule, "listSessions").mockResolvedValue([a, b]);
      spyOn(lastSessionModule, "readLastSession").mockResolvedValue("orc/b");

      const { result } = renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(result.current.selectedSessionId).toBe("orc/b");
      });
    });

    it("applies a last session that appears after the seed", async () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });
      spyOn(listSessionsModule, "listSessions").mockResolvedValue([a, b]);
      // No last session when the store seeds, then one appears for the poll to apply.
      spyOn(lastSessionModule, "readLastSession")
        .mockResolvedValueOnce(null)
        .mockResolvedValue("orc/b");

      const { result } = renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(result.current.selectedSessionId).toBe("orc/b");
      });
    });

    it("clears the last session once it has been applied", async () => {
      const a = sessionFactory.build({ project: "orc", session: "a" });
      const b = sessionFactory.build({ project: "orc", session: "b" });
      spyOn(listSessionsModule, "listSessions").mockResolvedValue([a, b]);
      spyOn(lastSessionModule, "readLastSession").mockResolvedValue("orc/b");
      const removeLastSession = spyOn(lastSessionModule, "removeLastSession").mockResolvedValue();

      renderHook(() => useStore(), { wrapper });

      await waitFor(() => {
        expect(removeLastSession).toHaveBeenCalled();
      });
    });
  });
});
