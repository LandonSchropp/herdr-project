import { xdgConfigHome } from "../utilities/xdg.ts";
import { settingsSchema } from "./schema.ts";
import type { Settings } from "./types.ts";
import { join } from "node:path";

/**
 * Returns the path to orc's settings file. Honors `$XDG_CONFIG_HOME`, falling back to `~/.config`
 * when unset.
 *
 * @returns The absolute path to `settings.json`.
 */
export function settingsPath(): string {
  return join(xdgConfigHome(), "orc", "settings.json");
}

/**
 * Reads and validates orc's settings. Falls back to the default settings when the settings file
 * does not exist; throws when the file is present but malformed or fails validation.
 *
 * @returns The validated settings.
 * @throws If the settings file is present but contains invalid JSON or fails the schema.
 */
export async function readSettings(): Promise<Settings> {
  const file = Bun.file(settingsPath());

  if (!(await file.exists())) {
    return settingsSchema.parse({});
  }

  return settingsSchema.parse(await file.json());
}
