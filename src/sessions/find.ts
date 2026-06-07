import type { Session } from "../types.ts";
import { listSessions } from "./list.ts";

/**
 * Finds the orc session with the given `project` and `session`, whether running, stopped, or
 * deleted. Sourced from the session files, so it finds sessions that have no live tmux session.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @returns The matching session, or `null` if none exists.
 */
export async function findSession(project: string, session: string): Promise<Session | null> {
  const sessions = await listSessions();
  return (
    sessions.find((candidate) => candidate.project === project && candidate.session === session) ??
    null
  );
}
