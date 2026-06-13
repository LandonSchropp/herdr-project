import {
  attachTmuxSession,
  createTmuxSessionUnlessExists,
  currentTmuxSession,
  isInsideOrcTmuxSession,
  switchTmuxSession,
} from "../commands/tmux.ts";
import { setLastSession } from "./last-session.ts";

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

/** Ensures the hidden TUI session exists, creating it if needed, then moves to it. */
export async function attachOrSwitchToTuiSession(): Promise<void> {
  await createTmuxSessionUnlessExists(TUI_SESSION, tuiSessionCommand(), {
    statusBar: false,
  });

  if (isInsideOrcTmuxSession()) {
    const cameFrom = await currentTmuxSession();
    if (cameFrom) await setLastSession(cameFrom);
    await switchTmuxSession(TUI_SESSION);
  } else {
    await attachTmuxSession(TUI_SESSION);
  }
}
