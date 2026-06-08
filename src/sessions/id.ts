/**
 * Returns the orc id for a session — the combined `project/session` string used as the tmux session
 * name, the worktree key, and the prefix on agent state files.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @returns The `project/session` id.
 */
export function sessionId(project: string, session: string): string {
  return `${project}/${session}`;
}

/**
 * Splits a session id back into its project and session parts. Only the first slash separates the
 * two, so slashes inside the session part are preserved. Returns `null` for ids that don't contain
 * a slash (e.g. foreign tmux sessions on the orc socket).
 *
 * @param id The session id to parse.
 * @returns A `[project, session]` tuple, or `null` if the id has no slash.
 */
export function parseSessionId(id: string): [string, string] | null {
  const slash = id.indexOf("/");
  if (slash === -1) return null;
  return [id.slice(0, slash), id.slice(slash + 1)];
}
