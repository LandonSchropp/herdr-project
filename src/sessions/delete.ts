import { removeWorktree, worktreeExists } from "../commands/git.ts";
import { killTmuxSession } from "../commands/tmux.ts";
import { sessionId } from "./id.ts";
import { worktreePath } from "./paths.ts";
import { readSessionFile, removeSessionFile } from "./session-file.ts";
import { removeSessionStateFiles } from "./state.ts";

/**
 * Deletes an orc session. Kills the tmux session, removes the session's Git worktree, and cleans up
 * its session file and any agent state files left behind. The repository is resolved from the
 * persisted session file rather than the worktree directory, so removal still cleans up Git's
 * registration when the worktree directory is already gone (a prunable worktree). Removal is
 * guarded on the worktree being registered in Git, not on the directory existing on disk. Does not
 * delete the underlying branch.
 *
 * @param project The project name.
 * @param session The session name within the project.
 */
export async function deleteSession(project: string, session: string): Promise<void> {
  // Kill the session first so an interruption can never leave a live session whose panes point at an
  // already-deleted worktree directory.
  await killTmuxSession(sessionId(project, session));

  const sessionInfo = await readSessionFile(project, session);

  if (sessionInfo) {
    const path = worktreePath(project, session);

    if (await worktreeExists(sessionInfo.repositoryRoot, path)) {
      await removeWorktree(sessionInfo.repositoryRoot, path);
    }
  }

  await removeSessionStateFiles(project, session);
  await removeSessionFile(project, session);
}
