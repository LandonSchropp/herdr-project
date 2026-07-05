import { ORC_STATE_DIRECTORY } from "../directories.ts";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Returns the absolute path to the orc crash log.
 *
 * @returns The path under `$XDG_CACHE_HOME/orc/state/crash.log`.
 */
export function crashLogPath(): string {
  return join(ORC_STATE_DIRECTORY, "crash.log");
}

/**
 * Appends a timestamped entry describing a crash to the crash log, creating the log directory if
 * needed. Records an `Error`'s stack (which for a {@link CommandError} includes the failed command's
 * output), or an inspection of any other thrown value.
 *
 * @param error The thrown value that crashed orc.
 * @returns The absolute path to the crash log.
 */
export function writeCrashLog(error: unknown): string {
  const path = crashLogPath();
  const details = error instanceof Error ? (error.stack ?? error.message) : Bun.inspect(error);
  const entry = `=== ${new Date().toISOString()} ===\n${details}\n\n`;

  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, entry);

  return path;
}
