import { orcCacheDirectory } from "../utilities/xdg.ts";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Returns the path to the last-session file. The file records the session that was current when orc
 * was opened so the process that opens orc can hand it to the long-lived TUI process, which reads
 * it on its next poll.
 *
 * @returns The absolute path under `$XDG_CACHE_HOME/orc/state/last-session`.
 */
export function lastSessionFilePath(): string {
  return join(orcCacheDirectory(), "state", "last-session");
}

/**
 * Records the id of the session that was current when orc was opened. Creates the state directory
 * if needed.
 *
 * @param id The id of the session orc was opened from.
 */
export async function setLastSession(id: string): Promise<void> {
  const path = lastSessionFilePath();
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, id);
}

/** Clears the recorded last session. */
export async function removeLastSession(): Promise<void> {
  await rm(lastSessionFilePath(), { force: true });
}

/**
 * Reads the session that was current when orc was opened.
 *
 * @returns The recorded session id, or `null` when none is recorded.
 */
export async function readLastSession(): Promise<string | null> {
  const file = Bun.file(lastSessionFilePath());
  if (!(await file.exists())) return null;

  const id = (await file.text()).trim();
  return id.length > 0 ? id : null;
}
