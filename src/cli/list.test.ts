import { sessionFactory } from "../../test/factories/session.ts";
import { stdoutSpy } from "../../test/helpers/process.ts";
import type { Session } from "../types.ts";
import { listCommand } from "./list.ts";
import { describe, expect, it, mock } from "bun:test";
import { runCommand } from "citty";

const listSessionsMock = mock((): Promise<Session[]> => Promise.resolve([]));

await mock.module("../sessions/list.ts", () => ({
  listSessions: listSessionsMock,
}));

describe("listCommand", () => {
  describe("when there are no sessions", () => {
    it("prints nothing", async () => {
      listSessionsMock.mockResolvedValue([]);

      await runCommand(listCommand, { rawArgs: [] });

      expect(stdoutSpy).not.toHaveBeenCalled();
    });
  });

  describe("when there are running sessions", () => {
    it("prints each one", async () => {
      listSessionsMock.mockResolvedValue([
        sessionFactory.build({ session: "feature-a", status: "running" }),
        sessionFactory.build({ session: "feature-b", status: "running" }),
      ]);

      await runCommand(listCommand, { rawArgs: [] });

      expect(stdoutSpy).toHaveBeenCalledWith("orc/feature-a\n");
      expect(stdoutSpy).toHaveBeenCalledWith("orc/feature-b\n");
    });
  });

  describe("when a session is stopped", () => {
    it("annotates it as stopped", async () => {
      listSessionsMock.mockResolvedValue([
        sessionFactory.build({ session: "feature-a", status: "stopped" }),
      ]);

      await runCommand(listCommand, { rawArgs: [] });

      expect(stdoutSpy).toHaveBeenCalledWith("orc/feature-a (stopped)\n");
    });
  });

  describe("when a session's worktree is deleted", () => {
    it("annotates it as deleted", async () => {
      listSessionsMock.mockResolvedValue([
        sessionFactory.build({ session: "feature-a", status: "deleted" }),
      ]);

      await runCommand(listCommand, { rawArgs: [] });

      expect(stdoutSpy).toHaveBeenCalledWith("orc/feature-a (deleted)\n");
    });
  });
});
