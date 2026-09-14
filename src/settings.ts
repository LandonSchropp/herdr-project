import type { Project, Settings, Tab } from "./types.ts";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * The layout used when the settings declare no `default` project: a single shell, which is what
 * Herdr gives a new workspace anyway.
 */
const FALLBACK_TABS: Tab[] = [{ name: "shell", command: null }];

/**
 * The name of the project that supplies the tabs every other project inherits. It is a layout
 * rather than somewhere to open, so it has no path and never appears in the picker.
 */
export const DEFAULT_PROJECT_NAME = "default";

/**
 * The path to the plugin's settings file. Override with `HERDR_PROJECT_SETTINGS`.
 *
 * @returns The absolute path to `settings.json`.
 */
export function settingsPath(): string {
  const override = process.env.HERDR_PROJECT_SETTINGS;
  return override ? expandHome(override) : join(homedir(), ".config/herdr-project/settings.json");
}

/**
 * Expands a leading `~/` to the user's home directory, leaving every other path untouched.
 *
 * @param path The path to expand.
 * @returns The expanded path.
 */
export function expandHome(path: string): string {
  return path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
}

/**
 * Collapses a leading home directory to `~`, the inverse of {@link expandHome}, leaving every other
 * path untouched.
 *
 * @param path The path to collapse.
 * @returns The collapsed path.
 */
export function collapseHome(path: string): string {
  const home = homedir();

  if (path === home) return "~";
  if (path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;

  return path;
}

/**
 * Reads a list of tabs, keeping only entries that name the tab. A tab's `command` is optional;
 * without one the tab is left as a plain shell.
 *
 * @param value The value to read the tabs from.
 * @returns The tabs, which is empty when the value is not a list of objects.
 */
export function parseTabs(value: unknown): Tab[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry: unknown) => {
    const tab = entry as { name?: unknown; command?: unknown };

    if (typeof tab.name !== "string") return [];

    return [{ name: tab.name, command: typeof tab.command === "string" ? tab.command : null }];
  });
}

/**
 * Reads the explicitly declared projects. An entry needs a `path`; its `name` defaults to the
 * directory's name, its `tabs` to `defaultTabs`, its `focusedTab` to `defaultFocusedTab`, and its
 * `prompt` to none.
 *
 * @param value The value to read the projects from.
 * @param defaultTabs The tabs to use for a project that declares none.
 * @param defaultFocusedTab The tab to focus for a project that declares none.
 * @returns The projects, which is empty when the value is not a list of objects.
 */
export function parseProjects(
  value: unknown,
  defaultTabs: Tab[],
  defaultFocusedTab: string | null,
): Project[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry: unknown) => {
    const project = entry as {
      name?: unknown;
      path?: unknown;
      tabs?: unknown;
      focusedTab?: unknown;
      prompt?: unknown;
    };

    if (typeof project.path !== "string") return [];

    const repositoryRoot = expandHome(project.path);
    const tabs = parseTabs(project.tabs);

    return [
      {
        name: typeof project.name === "string" ? project.name : basename(repositoryRoot),
        repositoryRoot,
        tabs: tabs.length > 0 ? tabs : defaultTabs,
        focusedTab: typeof project.focusedTab === "string" ? project.focusedTab : defaultFocusedTab,
        prompt: typeof project.prompt === "string" ? project.prompt : null,
      },
    ];
  });
}

/**
 * Parses the plugin's settings. Every field is optional: settings that declare none behave as if
 * the file were absent.
 *
 * @param contents The raw JSON contents.
 * @returns The parsed settings, or `null` when the JSON is malformed.
 */
export function parseSettings(contents: string): Settings | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

  const { projectPaths, flat, projects } = parsed as Record<string, unknown>;
  const entries = Array.isArray(projects) ? projects : [];
  const isDefault = (entry: unknown) =>
    (entry as { name?: unknown })?.name === DEFAULT_PROJECT_NAME;

  const defaultEntry = entries.find(isDefault) as
    { tabs?: unknown; focusedTab?: unknown } | undefined;
  const declaredTabs = parseTabs(defaultEntry?.tabs);
  const defaultTabs = declaredTabs.length > 0 ? declaredTabs : FALLBACK_TABS;
  const defaultFocusedTab =
    typeof defaultEntry?.focusedTab === "string" ? defaultEntry.focusedTab : null;

  return {
    projectPaths: Array.isArray(projectPaths)
      ? projectPaths.filter((path): path is string => typeof path === "string").map(expandHome)
      : [],
    flat: flat === true,
    defaultTabs,
    defaultFocusedTab,
    projects: parseProjects(
      entries.filter((entry) => !isDefault(entry)),
      defaultTabs,
      defaultFocusedTab,
    ),
  };
}

/**
 * Loads the plugin's settings. A missing or malformed file yields the defaults, so the picker still
 * works before any settings exist.
 *
 * @returns The settings.
 */
export async function loadSettings(): Promise<Settings> {
  const defaults = parseSettings("{}") as Settings;
  const contents = await Bun.file(settingsPath())
    .text()
    .catch(() => null);

  if (contents === null) return defaults;

  return parseSettings(contents) ?? defaults;
}
