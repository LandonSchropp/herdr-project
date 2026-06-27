import { isInsideOrcTmuxSession, sessionId } from "../commands/tmux.ts";
import { parseSessionId } from "./id.ts";

/**
 * Returns the project and session of the orc session the caller is running inside, determined from
 * the tmux pane in the process environment. Returns `null` when the caller is not running inside an
 * orc session.
 *
 * @returns A `[project, session]` tuple, or `null`.
 */
export async function getCallerSession(): Promise<[string, string] | null> {
  if (!isInsideOrcTmuxSession()) return null;

  const paneId = process.env.TMUX_PANE;
  if (!paneId) return null;

  return parseSessionId(await sessionId(paneId));
}
