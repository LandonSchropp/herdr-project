import { homedir } from "node:os";
import { join } from "node:path";

/** The value of `$XDG_CONFIG_HOME`, falling back to `~/.config` when unset. */
export const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");

/** The value of `$XDG_CACHE_HOME`, falling back to `~/.cache` when unset. */
export const XDG_CACHE_HOME = process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache");

/** Orc's configuration directory: `$XDG_CONFIG_HOME/orc`. */
export const ORC_CONFIG_DIRECTORY = join(XDG_CONFIG_HOME, "orc");

/** Orc's cache directory: `$XDG_CACHE_HOME/orc`. Holds worktrees and orc-managed runtime state. */
export const ORC_CACHE_DIRECTORY = join(XDG_CACHE_HOME, "orc");

/** The directory orc writes runtime state files under: `$XDG_CACHE_HOME/orc/state`. */
export const ORC_STATE_DIRECTORY = join(ORC_CACHE_DIRECTORY, "state");

/** The directory orc creates session worktrees under: `$XDG_CACHE_HOME/orc/worktrees`. */
export const ORC_WORKTREES_DIRECTORY = join(ORC_CACHE_DIRECTORY, "worktrees");
