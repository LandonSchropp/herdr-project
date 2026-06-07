import { sessionFactory } from "../../test/factories/session.ts";
import { createOrSwitchSession } from "./create-or-switch-session.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";

const createSessionMock = mock((): Promise<void> => Promise.resolve());
const switchSessionMock = mock((): Promise<void> => Promise.resolve());

await mock.module("./create.ts", () => ({
  createSession: createSessionMock,
}));

await mock.module("./switch.ts", () => ({
  switchSession: switchSessionMock,
}));

describe("createOrSwitchSession", () => {
  describe("when the session is running", () => {
    beforeEach(async () => {
      await createOrSwitchSession(
        sessionFactory.build({ project: "orc", session: "feature-a", status: "running" }),
      );
    });

    it("switches to it", () => {
      expect(switchSessionMock).toHaveBeenCalledWith("orc", "feature-a");
    });

    it("does not recreate it", () => {
      expect(createSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("when the session is stopped", () => {
    it("recreates it from its project source", async () => {
      await createOrSwitchSession(
        sessionFactory.build({
          project: "orc",
          session: "feature-a",
          status: "stopped",
          kind: "tmuxinator",
          repositoryRoot: "/repos/orc",
        }),
      );

      expect(createSessionMock).toHaveBeenCalledWith(
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
        "feature-a",
      );
    });
  });

  describe("when the session is deleted", () => {
    it("recreates it from its project source", async () => {
      await createOrSwitchSession(
        sessionFactory.build({
          project: "orc",
          session: "feature-a",
          status: "deleted",
          kind: "tmuxinator",
          repositoryRoot: "/repos/orc",
        }),
      );

      expect(createSessionMock).toHaveBeenCalledWith(
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
        "feature-a",
      );
    });
  });
});
