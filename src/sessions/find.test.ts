import { sessionFactory } from "../../test/factories/session.ts";
import type { Session } from "../types.ts";
import { findSession } from "./find.ts";
import { describe, expect, it, mock } from "bun:test";

const listSessionsMock = mock((): Promise<Session[]> => Promise.resolve([]));

await mock.module("./list.ts", () => ({
  listSessions: listSessionsMock,
}));

describe("findSession", () => {
  describe("when a session with the matching project and name exists", () => {
    it("returns it", async () => {
      const a = sessionFactory.build({ project: "p1", session: "a" });
      const b = sessionFactory.build({ project: "p2", session: "a" });
      listSessionsMock.mockResolvedValue([a, b]);

      expect(await findSession("p2", "a")).toBe(b);
    });
  });

  describe("when no session matches", () => {
    it("returns null", async () => {
      const a = sessionFactory.build({ project: "p1", session: "a" });
      listSessionsMock.mockResolvedValue([a]);

      expect(await findSession("p1", "missing")).toBeNull();
    });
  });
});
