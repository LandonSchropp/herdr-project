import {
  attachTmuxSession,
  createTmuxSessionUnlessExists,
  isInsideOrcTmuxSession,
  switchTmuxSession,
} from "../commands/tmux.ts";

/**
 * Name of the hidden tmux session that hosts the orc TUI. No slash keeps it out of the session
 * list.
 */
export const CONTROL_SESSION = "_tui";

/**
 * Environment variable the control session sets when it re-invokes orc, signalling that this
 * process should render the TUI directly instead of entering the control session again.
 */
const RENDER_TUI_ENVIRONMENT_VARIABLE = "ORC_INTERNAL_RENDER_TUI";

/**
 * Whether this process should render the TUI directly, rather than enter the control session. True
 * only when orc was re-invoked from inside the control session.
 *
 * @returns `true` when the render-TUI flag is set.
 */
export function shouldRenderTui(): boolean {
  return process.env[RENDER_TUI_ENVIRONMENT_VARIABLE] === "1";
}

/**
 * Builds the shell command the control session runs to render the TUI directly.
 *
 * @returns The shell command for the control session.
 */
function controlSessionCommand(): string {
  const tokens = [process.execPath, process.argv[1]].map((token) => Bun.$.escape(token));
  return `${RENDER_TUI_ENVIRONMENT_VARIABLE}=1 ${tokens.join(" ")}`;
}

/**
 * Ensures the hidden control session exists, creating it if needed, then moves to it.
 */
export async function attachOrSwitchToControlSession(): Promise<void> {
  await createTmuxSessionUnlessExists(CONTROL_SESSION, controlSessionCommand(), {
    statusBar: false,
  });

  if (isInsideOrcTmuxSession()) {
    await switchTmuxSession(CONTROL_SESSION);
  } else {
    await attachTmuxSession(CONTROL_SESSION);
  }
}
