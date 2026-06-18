import {
  attachTmuxSession,
  createTmuxSession,
  currentTmuxSession,
  hasTmuxSession,
  isInsideOrcTmuxSession,
  killTmuxSession,
  switchTmuxSession,
} from "../commands/tmux.ts";
import { removeLastSession, setLastSession } from "./last-session.ts";

/**
 * Name of the hidden tmux session that hosts the orc TUI. No slash keeps it out of the session
 * list.
 */
export const TUI_SESSION = "_tui";

/**
 * Environment variable the TUI session sets when it re-invokes orc, signalling that this process
 * should render the TUI directly instead of entering the TUI session again.
 */
const RENDER_TUI_ENVIRONMENT_VARIABLE = "ORC_INTERNAL_RENDER_TUI";

/**
 * Whether this process should render the TUI directly, rather than enter the TUI session. True only
 * when orc was re-invoked from inside the TUI session.
 *
 * @returns `true` when the render-TUI flag is set.
 */
export function shouldRenderTui(): boolean {
  return process.env[RENDER_TUI_ENVIRONMENT_VARIABLE] === "1";
}

/**
 * Builds the shell command the TUI session runs to render the TUI directly.
 *
 * @returns The shell command for the TUI session.
 */
function tuiSessionCommand(): string {
  const tokens = [process.execPath, process.argv[1]].map((token) => Bun.$.escape(token));
  return `${RENDER_TUI_ENVIRONMENT_VARIABLE}=1 ${tokens.join(" ")}`;
}

/** Kills the TUI session if it is running. */
export async function closeTuiSession(): Promise<void> {
  if (await hasTmuxSession(TUI_SESSION)) {
    await killTmuxSession(TUI_SESSION);
  }
}

/**
 * Starts a fresh TUI session and moves to it. The TUI exits when the user leaves it, which tears
 * down its session, so there is normally nothing to close first; closing is a backup for a TUI that
 * crashed or a `remain-on-exit on` config that left a dead pane behind. Starting fresh each open
 * keeps the selection from going stale: the new TUI seeds it from the last session on its first
 * render.
 */
export async function startTuiSession(): Promise<void> {
  const insideOrcTmuxSession = isInsideOrcTmuxSession();
  const cameFrom = insideOrcTmuxSession ? await currentTmuxSession() : null;

  // Hand the new TUI the session we're leaving so it seeds its selection with it on its first
  // render. Launching from outside orc has no such session, so clear the record and let it open on
  // the first session.
  if (cameFrom) {
    await setLastSession(cameFrom);
  } else {
    await removeLastSession();
  }

  // The TUI tears itself down on exit, so there is normally no session here; close it anyway as a
  // backup in case it crashed or was left behind, so the next step always starts from a clean slate.
  await closeTuiSession();

  await createTmuxSession(TUI_SESSION, tuiSessionCommand(), { statusBar: false });

  if (insideOrcTmuxSession) {
    await switchTmuxSession(TUI_SESSION);
  } else {
    await attachTmuxSession(TUI_SESSION);
  }
}
