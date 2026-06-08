import { listTmuxPanes, listTmuxSessions } from "../commands/tmux.ts";
import {
  DELETED_SESSION_STATUS,
  IDLE_AGENT_STATUS,
  RUNNING_SESSION_STATUS,
  STOPPED_SESSION_STATUS,
} from "../constants.ts";
import type {
  Agent,
  Session,
  SessionInfo,
  SessionStatus,
  TmuxPane,
  TmuxSession,
} from "../types.ts";
import { exists } from "../utilities/exists.ts";
import { isAgentPane } from "./agents.ts";
import { MAIN_SESSION_NAME } from "./main-worktree.ts";
import { worktreePath } from "./paths.ts";
import { listSessionFiles } from "./session-file.ts";
import { readStateFile } from "./state.ts";

/**
 * Reads the agent state for a single pane and returns the corresponding {@link Agent}, defaulting to
 * {@link IDLE_AGENT_STATUS} when no state has been recorded for the pane yet.
 *
 * @param project The project name owning the pane.
 * @param session The session name within the project.
 * @param pane The Claude-hosting pane to inspect.
 * @returns The agent for that pane.
 */
async function buildAgent(project: string, session: string, pane: TmuxPane): Promise<Agent> {
  const state = await readStateFile(project, session, pane.paneId);

  // No state file yet means the agent has only just appeared, so treat now as when its (idle)
  // status began.
  if (state === null) {
    return { paneId: pane.paneId, status: IDLE_AGENT_STATUS, updatedAt: new Date() };
  }

  return { paneId: pane.paneId, status: state.status, updatedAt: new Date(state.timestamp) };
}

/**
 * Determines a session's {@link SessionStatus}. A non-main session whose worktree directory is gone
 * is `deleted` even when tmux is still running it, since the worktree it depended on no longer
 * exists. Otherwise it is `running` when a live tmux session backs it, and `stopped` when not. The
 * main session has no dedicated worktree, so it is never `deleted`.
 *
 * @param sessionInfo The session's persisted info.
 * @param tmuxSession The live tmux session backing it, or `undefined` when not live.
 * @returns The session's status.
 */
async function sessionStatus(
  sessionInfo: SessionInfo,
  tmuxSession: TmuxSession | undefined,
): Promise<SessionStatus> {
  if (
    sessionInfo.session !== MAIN_SESSION_NAME &&
    !(await exists(worktreePath(sessionInfo.project, sessionInfo.session)))
  ) {
    return DELETED_SESSION_STATUS;
  }

  return tmuxSession !== undefined ? RUNNING_SESSION_STATUS : STOPPED_SESSION_STATUS;
}

/**
 * Builds a full {@link Session} by joining a session's persisted info with its live tmux state. A
 * session is `running` when a live tmux session backs it — its agents come from that session's
 * agent panes — and `stopped` otherwise. A stopped session has no live panes, so its agents come
 * out empty.
 *
 * @param sessionInfo The session's persisted info.
 * @param tmuxSession The live tmux session backing it, or `undefined` when the session is stopped.
 * @param tmuxPanes Every tmux pane across all sessions; this session's agent panes are selected
 *   from them.
 * @returns The session with its live state and agents populated.
 */
async function buildSession(
  sessionInfo: SessionInfo,
  tmuxSession: TmuxSession | undefined,
  tmuxPanes: TmuxPane[],
): Promise<Session> {
  const agents = await Promise.all(
    tmuxPanes
      .filter((pane) => pane.sessionId === sessionInfo.id && isAgentPane(pane))
      .map((pane) => buildAgent(sessionInfo.project, sessionInfo.session, pane)),
  );

  return {
    ...sessionInfo,
    status: await sessionStatus(sessionInfo, tmuxSession),
    worktree: sessionInfo.session === MAIN_SESSION_NAME ? "main" : "linked",
    agents,
  };
}

/**
 * The state of an Orc session is spread across several places:
 *
 * - Cache: Orc writes a state file for every session it creates. These files are the source of record
 *   — a session exists if and only if it has one.
 * - Tmux: A running session is backed by a live tmux session (one-to-one). A stopped session has
 *   none.
 * - Git worktrees: Every session other than `main` owns a Git worktree on disk.
 *
 * Ideally these sources would all _agree_ on which sessions are active, but they don't always.
 * Depending on how Orc was closed, how tmux was closed, whether a worktree was deleted, whether the
 * system restarted, and so on, they can disagree, and that disagreement is what the session's
 * `status` captures.
 *
 * This function lists every recorded session (one per state file) and reconciles each against tmux
 * and the worktrees to determine its status. The state files drive membership; tmux and the
 * worktrees only set status, so they never add or remove a session from the list.
 *
 * @returns The Orc sessions.
 */
export async function listSessions(): Promise<Session[]> {
  const [infos, tmuxSessions, panes] = await Promise.all([
    listSessionFiles(),
    listTmuxSessions(),
    listTmuxPanes(),
  ]);

  // TODO: Should we group all of these sources together in advance, and then pass them into a
  // function that builds the session object?

  const liveSessionsById = new Map(tmuxSessions.map((session) => [session.id, session]));

  return Promise.all(infos.map((info) => buildSession(info, liveSessionsById.get(info.id), panes)));
}
