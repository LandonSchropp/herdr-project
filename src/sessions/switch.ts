import { attachTmuxSession, isInsideOrcTmuxSession, switchTmuxSession } from "../commands/tmux.ts";
import { sessionId } from "./id.ts";

/**
 * Switches to the orc session identified by `project` and `session`, whether called from inside an
 * orc tmux session or from a plain terminal.
 *
 * @param project The project name.
 * @param session The session name within the project.
 */
export async function switchSession(project: string, session: string): Promise<void> {
  const id = sessionId(project, session);
  if (isInsideOrcTmuxSession()) {
    await switchTmuxSession(id);
  } else {
    await attachTmuxSession(id);
  }
}
