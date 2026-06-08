import { RUNNING_SESSION_STATUS } from "../../constants.ts";
import type { Session } from "../../types.ts";
import { AgentStatus } from "./agent-status.tsx";
import { SessionStatus } from "./session-status.tsx";

type StatusProps = {
  /** The session whose status to render. */
  session: Session;
  /** Whether the owning Session is selected. */
  selected?: boolean;
};

/**
 * Renders a session's status: the agent's activity while the session is running, otherwise the
 * session's lifecycle status.
 */
export function Status({ session, selected }: StatusProps) {
  if (session.status === RUNNING_SESSION_STATUS) {
    return <AgentStatus agent={session.agents[0]} selected={selected} />;
  }

  return <SessionStatus status={session.status} />;
}
