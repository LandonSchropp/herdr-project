import type { Project } from "./types.ts";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The directory holding the project definition TOML files. Defaults to the Herdr Plus projects
 * directory, which is where Herdr's project templates already live, and can be pointed elsewhere
 * with `HERDR_PROJECTS_DIRECTORY`.
 *
 * @returns The absolute path to the projects directory.
 */
export function projectsDirectory(): string {
  const override = process.env.HERDR_PROJECTS_DIRECTORY;

  return override
    ? expandHome(override)
    : join(homedir(), ".config/herdr/plugins/config/cloudmanic.herdr-plus/projects");
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
 * Parses a project definition TOML into a {@link Project}. Only `name` and `working_dir` are read;
 * the tab and pane tables Herdr Plus uses to lay out a workspace are ignored.
 *
 * @param contents The raw TOML contents.
 * @returns The parsed project, or `null` when the TOML is malformed or missing a required field.
 */
export function parseProject(contents: string): Project | null {
  let parsed: unknown;

  try {
    parsed = Bun.TOML.parse(contents);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const { name, working_dir: workingDirectory } = parsed as Record<string, unknown>;

  if (typeof name !== "string" || typeof workingDirectory !== "string") return null;

  return { name, repositoryRoot: expandHome(workingDirectory) };
}

/**
 * Loads every project definition from {@link projectsDirectory}, skipping files that are malformed
 * or missing required fields. A missing directory yields no projects rather than an error, so the
 * picker degrades to an empty list instead of crashing.
 *
 * @returns The projects, sorted by name.
 */
export async function listProjects(): Promise<Project[]> {
  const directory = projectsDirectory();
  let entries: string[];

  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }

  const projects = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".toml"))
      .map(async (entry) => parseProject(await Bun.file(join(directory, entry)).text())),
  );

  return projects
    .filter((project): project is Project => project !== null)
    .sort((first, second) => first.name.localeCompare(second.name));
}
