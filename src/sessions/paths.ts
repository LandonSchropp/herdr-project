import { ORC_WORKTREES_DIRECTORY } from "../directories.ts";
import { join } from "node:path";

/**
 * Returns the orc cache path for the given project's session worktree.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @returns The absolute path under `$XDG_CACHE_HOME/orc/worktrees`.
 */
export function worktreePath(project: string, session: string): string {
  return join(ORC_WORKTREES_DIRECTORY, project, session);
}
