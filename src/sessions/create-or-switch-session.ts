import { RUNNING_SESSION_STATUS } from "../constants.ts";
import type { Session } from "../types.ts";
import { createSession } from "./create.ts";
import { switchSession } from "./switch.ts";

/**
 * Switches to a session when it is already running, otherwise recreates it (restoring its worktree
 * when it was deleted) and switches to it. The session's original creation time is preserved.
 *
 * @param session The session to switch to or recreate.
 */
export async function createOrSwitchSession(session: Session): Promise<void> {
  if (session.status === RUNNING_SESSION_STATUS) {
    await switchSession(session.project, session.session);
    return;
  }

  await createSession(
    { kind: session.kind, name: session.project, repositoryRoot: session.repositoryRoot },
    session.session,
  );
}
