import { sessionFactory } from "../../../test/factories/session.ts";
import * as lastSessionModule from "../../sessions/last-session.ts";
import * as listSessionsModule from "../../sessions/list.ts";
import { StoreProvider, useStore } from "./store.tsx";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as ink from "ink";
import type { ReactNode } from "react";

GlobalRegistrator.register();

await mock.module("ink", () => ({
  ...ink,
  useWindowSize: mock(() => ({ columns: 100, rows: 30 })),
}));

beforeEach(() => {
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
  });
});
