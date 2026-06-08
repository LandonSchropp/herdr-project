import { orcCacheDirectory } from "../utilities/xdg.ts";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Returns the absolute path to the orc hook event log.
 *
 * @returns The path under `$XDG_CACHE_HOME/orc/state/hook.log`.
 */
export function hookLogPath(): string {
  return join(orcCacheDirectory(), "state", "hook.log");
}

/**
 * Appends an entry for a hook event to the hook log, recording the time, the firing pane, and the
 * raw payload. Best-effort: any failure to write is swallowed so logging never blocks or breaks the
 * hook handler.
 *
 * @param paneId The tmux pane id where the hook fired.
 * @param payload The raw hook payload received from stdin.
 */
export async function logHookEvent(paneId: string, payload: unknown): Promise<void> {
  const entry = { timestamp: new Date().toISOString(), paneId, payload };
  const path = hookLogPath();

  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging is best-effort; never propagate failures to the hook handler.
  }
}
