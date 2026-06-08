import { isAgentState } from "../type-guards.ts";
import { type AgentState, type AgentStatus } from "../types.ts";
import { safeGlob } from "../utilities/glob.ts";
import { orcCacheDirectory } from "../utilities/xdg.ts";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Returns the absolute path to the agent state file for the given project, session, and pane.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @param paneId The tmux pane id (e.g. `%5`).
 * @returns The absolute path under `$XDG_CACHE_HOME/orc/state/<project>:<session>:<paneId>.json`.
 */
export function stateFilePath(project: string, session: string, paneId: string): string {
  return join(orcCacheDirectory(), "state", `${project}:${session}:${paneId}.json`);
}

/**
 * Writes the given status to the agent state file. Creates the state directory if needed and
 * overwrites any existing file.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @param paneId The tmux pane id.
 * @param status The agent status to record.
 */
export async function writeStateFile(
  project: string,
  session: string,
  paneId: string,
  status: AgentStatus,
): Promise<void> {
  const path = stateFilePath(project, session, paneId);
  await mkdir(dirname(path), { recursive: true });
  const state: AgentState = { status, timestamp: new Date().toISOString() };
  await Bun.write(path, JSON.stringify(state));
}

/**
 * Reads the agent state file for the given project, session, and pane.
 *
 * @param project The project name.
 * @param session The session name within the project.
 * @param paneId The tmux pane id.
 * @returns The parsed agent state, or `null` if the file does not exist.
 * @throws If the file exists but cannot be parsed or has an invalid shape.
 */
export async function readStateFile(
  project: string,
  session: string,
  paneId: string,
): Promise<AgentState | null> {
  const path = stateFilePath(project, session, paneId);
  const file = Bun.file(path);
  if (!(await file.exists())) return null;

  const parsed = await file.json();

  if (!isAgentState(parsed)) {
    throw new Error(`Agent state file at ${path} has an invalid shape`);
  }

  return parsed;
}

/**
 * Removes every state file belonging to a session. Used to clean up after `orc delete`. No-op when
 * the state directory does not exist or has no matching files.
 *
 * @param project The project name.
 * @param session The session name within the project.
 */
export async function removeSessionStateFiles(project: string, session: string): Promise<void> {
  const directory = join(orcCacheDirectory(), "state");
  const names = await safeGlob(`${project}:${session}:*.json`, { cwd: directory });

  await Promise.all(names.map((name) => rm(join(directory, name), { force: true })));
}
