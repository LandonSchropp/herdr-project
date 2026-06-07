import type { Session } from "../types.ts";
import { createSession } from "./create.ts";
import { switchSession } from "./switch.ts";

/**
 * Switches to a session when it is already running, otherwise recreates its tmux session from its
 * project info — rebuilding the worktree from its branch when it was deleted — and switches to it.
 * Recreating reuses the existing session file, so the original creation time is preserved.
 *
 * @param session The session to switch to or recreate.
 */
export async function createOrSwitchSession(session: Session): Promise<void> {
  if (session.status === "running") {
    await switchSession(session.project, session.session);
    return;
  }

  await createSession(
    { kind: session.kind, name: session.project, repositoryRoot: session.repositoryRoot },
    session.session,
  );
}
