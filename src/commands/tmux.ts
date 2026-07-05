import type { TmuxPane, TmuxSession } from "../types.ts";
import { ORC_WORKTREES_DIRECTORY } from "../directories.ts";
import { runAttachedCommand, runCommand } from "./shell.ts";
import { sep } from "node:path";

/** Socket name for orc's isolated tmux server. */
export const ORC_SOCKET = "orc";

/** Tab-separated `-F` template for `tmux list-sessions`: name, created timestamp, working directory. */
const SESSION_FORMAT = "#S\t#{session_created}\t#{session_path}";

/** Tab-separated `-F` template for `tmux list-panes`: session name, pane id, pane title. */
const PANE_FORMAT = "#{session_name}\t#{pane_id}\t#{pane_title}";

/**
 * Checks if tmux is installed and available on PATH.
 *
 * @returns `true` when tmux is installed, otherwise `false`.
 */
export async function isTmuxInstalled(): Promise<boolean> {
  return (await runCommand(["tmux", "-V"], { error: false })).exitCode === 0;
}

/**
 * Returns `true` if the calling process is inside an orc tmux session.
 *
 * @returns `true` when inside an orc tmux session, otherwise `false`.
 */
export function isInsideOrcTmuxSession(): boolean {
  return process.env.TMUX?.split(",")[0].endsWith(`/${ORC_SOCKET}`) ?? false;
}

/**
 * Builds a command that runs tmux against orc's isolated server.
 *
 * @param args Arguments to pass to tmux, after the socket flag.
 * @returns The full command, ready to pass to {@link runCommand}.
 */
function tmuxCommand(args: string[]): string[] {
  return ["tmux", "-L", ORC_SOCKET, ...args];
}

/** Detaches the current client from the orc tmux server. Does nothing when there is no client. */
export async function detachTmuxClient(): Promise<void> {
  await runCommand(tmuxCommand(["detach-client"]), { error: false });
}

/**
 * Returns the orc id for the session the given pane belongs to.
 *
 * @param paneId The tmux pane id (e.g. `%5`).
 * @returns The session id (e.g. `project/feature-a`).
 * @throws If the session id cannot be determined.
 */
export async function sessionId(paneId: string): Promise<string> {
  const { stdout } = await runCommand(tmuxCommand(["display-message", "-p", "-t", paneId, "#S"]));
  return stdout.trim();
}

/**
 * Returns the name of the current client's session on orc's isolated server, or null when there is
 * no current session.
 *
 * @returns The current session name, or null.
 */
export async function currentTmuxSession(): Promise<string | null> {
  const command = tmuxCommand(["display-message", "-p", "#{session_name}"]);
  const { exitCode, stdout } = await runCommand(command, { error: false });

  if (exitCode !== 0) return null;

  return stdout.trim() || null;
}

/**
 * Returns the name of the session the current client was attached to before its current one, or
 * null when the client has no previous session.
 *
 * @returns The previous session name, or null.
 */
export async function previousTmuxSession(): Promise<string | null> {
  const command = tmuxCommand(["display-message", "-p", "#{client_last_session}"]);
  const { exitCode, stdout } = await runCommand(command, { error: false });

  if (exitCode !== 0) return null;

  return stdout.trim() || null;
}

/**
 * Checks whether a session with the given name exists on orc's isolated server.
 *
 * @param name The session name to check.
 * @returns `true` when the session exists, otherwise `false`.
 */
export async function hasTmuxSession(name: string): Promise<boolean> {
  const command = tmuxCommand(["has-session", "-t", name]);
  return (await runCommand(command, { error: false })).exitCode === 0;
}

/** Options for {@link createTmuxSession}. */
type CreateTmuxSessionOptions = {
  /** Whether the new session shows its status bar. Defaults to `true`. */
  statusBar?: boolean;
};

/**
 * Creates a detached session on orc's isolated server that runs the given command. When `statusBar`
 * is `false`, hides the session's status bar.
 *
 * @param name The name for the new session.
 * @param command The shell command the session's first pane runs.
 * @param options Session creation options.
 * @param options.statusBar Whether the new session shows its status bar. Defaults to `true`.
 * @throws If tmux fails to create the session.
 */
export async function createTmuxSession(
  name: string,
  command: string,
  { statusBar = true }: CreateTmuxSessionOptions = {},
): Promise<void> {
  const args = ["new-session", "-d", "-s", name, command];

  if (!statusBar) {
    args.push(";", "set-option", "-t", name, "status", "off");
  }

  await runCommand(tmuxCommand(args));
}

/**
 * Kills the orc tmux session with the given name.
 *
 * @param name The full `project/session` name to kill.
 * @throws If tmux fails to kill the session.
 */
export async function killTmuxSession(name: string): Promise<void> {
  await runCommand(tmuxCommand(["kill-session", "-t", name]));
}

/**
 * Switches the current orc tmux client to the session with the given name.
 *
 * @param name The full `project/session` name to switch to.
 */
export async function switchTmuxSession(name: string): Promise<void> {
  await runCommand(tmuxCommand(["switch-client", "-t", name]), { error: false });
}

/**
 * Attaches the calling process's terminal to the orc tmux session with the given name. Replaces
 * stdio for the duration of the session.
 *
 * @param name The full `project:session` name to attach to.
 */
export async function attachTmuxSession(name: string): Promise<void> {
  await runAttachedCommand(tmuxCommand(["attach-session", "-t", name]));
}

/**
 * Determines whether a failed tmux command's stderr indicates the orc server is simply unavailable
 * rather than a genuine error. Covers a missing server, a missing socket, a server shutting down,
 * and a non-zero exit with no message at all, which tmux can emit when the server is killed
 * mid-command.
 *
 * @param stderr The stderr captured from the failed tmux command.
 * @returns `true` when the failure reflects an unavailable server, otherwise `false`.
 */
function isTransientTmuxServerError(stderr: string): boolean {
  return (
    stderr.trim() === "" ||
    stderr.includes("no server running") ||
    stderr.includes("error connecting") ||
    stderr.includes("server exited unexpectedly") ||
    stderr.includes("lost server")
  );
}

/**
 * Lists the tmux sessions running on orc's isolated server. Returns an empty array when no server
 * is running or while one is shutting down. Sessions whose names do not follow orc's
 * `project/session` convention are skipped so foreign sessions on the orc socket do not break orc
 * commands.
 *
 * @returns The parsed tmux sessions.
 * @throws If tmux exits with an unexpected error.
 */
export async function listTmuxSessions(): Promise<TmuxSession[]> {
  const command = tmuxCommand(["list-sessions", "-F", SESSION_FORMAT]);
  const { exitCode, stdout, stderr } = await runCommand(command, { error: false });

  if (exitCode !== 0) {
    if (isTransientTmuxServerError(stderr)) return [];
    throw new Error(`tmux list-sessions failed: ${stderr.trim()}`);
  }

  return stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map(parseSessionLine)
    .filter((session) => session !== null);
}

/**
 * Parses a single tab-separated line emitted by `tmux list-sessions`. Returns `null` for session
 * names that do not contain a `/`, signalling a foreign session that should be skipped.
 *
 * @param line A line of tmux output: `name<TAB>created<TAB>path`.
 * @returns The parsed session, or `null` if the name is not in `project/session` form.
 */
function parseSessionLine(line: string): TmuxSession | null {
  const [id, createdAt, path] = line.split("\t");
  const separatorIndex = id.indexOf("/");

  if (separatorIndex === -1) return null;

  return {
    project: id.slice(0, separatorIndex),
    session: id.slice(separatorIndex + 1),
    id,
    createdAt: new Date(Number(createdAt) * 1000),
    worktree: path.startsWith(`${ORC_WORKTREES_DIRECTORY}${sep}`) ? "linked" : "main",
  };
}

/**
 * Lists every tmux pane across every session on orc's isolated server. Returns an empty array when
 * no server is running or while one is shutting down. Panes whose session names do not follow orc's
 * `project/session` convention are skipped so foreign sessions on the orc socket do not pollute
 * orc's view.
 *
 * @returns The parsed tmux panes.
 * @throws If tmux exits with an unexpected error.
 */
export async function listTmuxPanes(): Promise<TmuxPane[]> {
  const command = tmuxCommand(["list-panes", "-a", "-F", PANE_FORMAT]);
  const { exitCode, stdout, stderr } = await runCommand(command, { error: false });

  if (exitCode !== 0) {
    if (isTransientTmuxServerError(stderr)) return [];
    throw new Error(`tmux list-panes failed: ${stderr.trim()}`);
  }

  return stdout
    .split("\n")
    .filter((line) => line.length > 0)
    .map(parsePaneLine)
    .filter((pane) => pane !== null);
}

/**
 * Parses a single tab-separated line emitted by `tmux list-panes`. Returns `null` for session names
 * that do not contain a `/`, signalling a foreign session on the orc socket that should be
 * skipped.
 *
 * @param line A line of tmux output: `sessionId<TAB>paneId<TAB>paneTitle`.
 * @returns The parsed pane, or `null` if the session is not in `project/session` form.
 */
function parsePaneLine(line: string): TmuxPane | null {
  const [sessionId, paneId, paneTitle] = line.split("\t");

  if (!sessionId.includes("/")) return null;

  return { sessionId, paneId, paneTitle };
}
