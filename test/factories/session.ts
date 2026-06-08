import { RUNNING_SESSION_STATUS } from "../../src/constants.ts";
import type { Session } from "../../src/types.ts";
import { Factory } from "fishery";

export const sessionFactory = Factory.define<Session>(({ sequence, afterBuild }) => {
  afterBuild((session) => {
    session.id = `${session.project}/${session.session}`;
  });
  return {
    project: "orc",
    session: `feature-${sequence}`,
    id: "",
    kind: "tmuxinator",
    repositoryRoot: "/repos/orc",
    createdAt: new Date(),
    status: RUNNING_SESSION_STATUS,
    worktree: "main",
    agents: [],
  };
});
