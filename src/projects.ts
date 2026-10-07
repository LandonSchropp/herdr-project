import { loadSettings } from "./settings.ts";
import type { Project, Settings } from "./types.ts";
import { stat } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Reports whether a path exists, whether it is a file or a directory.
 *
 * @param path The path to check.
 * @returns Whether the path exists.
 */
async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/**
 * Reports whether a directory is a Git repository, which is true when it holds a `.git` entry — a
 * directory in a normal checkout, a file in a linked worktree.
 *
 * @param path The directory to check.
 * @returns Whether the directory is a repository.
 */
async function isRepository(path: string): Promise<boolean> {
  return exists(join(path, ".git"));
}

/**
 * Finds the Git repositories a project path refers to. The path is treated both as a directory and
 * as a glob, so a plain path resolves to itself and a pattern resolves to everything it matches.
 * Doing both avoids guessing which was meant: `Bun.Glob` matches nothing for a path with no
 * wildcards, and a directory's name is allowed to contain wildcard characters. A glob whose
 * directory does not exist matches nothing.
 *
 * @param pattern The absolute path or glob to scan.
 * @returns The absolute paths of the matching repositories, without duplicates.
 * @throws If the scan fails for any reason other than a missing directory.
 */
export async function scanRepositories(pattern: string): Promise<string[]> {
  const matches = new Set<string>();

  if (await isRepository(pattern)) matches.add(pattern);

  try {
    for await (const match of new Bun.Glob(pattern).scan({
      onlyFiles: false,
      absolute: true,
      followSymlinks: true,
    })) {
      if (await isRepository(match)) matches.add(match);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return [...matches];
}

/**
 * Discovers the projects under the settings' project paths. Each repository becomes a project named
 * after its directory, laid out with the default tabs and default focused tab.
 *
 * @param settings The settings to read the project paths, default tabs, and default focused tab
 *   from.
 * @returns The discovered projects.
 */
export async function discoverProjects(settings: Settings): Promise<Project[]> {
  const scans = await Promise.all(settings.projectPaths.map(scanRepositories));

  return scans.flat().map((repositoryRoot) => ({
    name: basename(repositoryRoot),
    repositoryRoot,
    tabs: settings.defaultTabs,
    focusedTab: settings.defaultFocusedTab,
    prompt: null,
  }));
}

/**
 * Combines the declared and discovered projects into the list the picker shows. A declared project
 * wins over a discovered one at the same path, so declaring a project is how you give a discovered
 * repository a different name or layout without listing every other repository.
 *
 * @param declared The projects declared in the settings.
 * @param discovered The projects found under the project paths.
 * @returns The merged projects, sorted by name.
 */
export function mergeProjects(declared: Project[], discovered: Project[]): Project[] {
  const declaredRoots = new Set(declared.map((project) => project.repositoryRoot));

  return [...declared, ...discovered.filter((p) => !declaredRoots.has(p.repositoryRoot))].sort(
    (first, second) => first.name.localeCompare(second.name),
  );
}

/**
 * Loads every project the picker can open.
 *
 * @returns The projects, sorted by name.
 */
export async function listProjects(): Promise<Project[]> {
  const settings = await loadSettings();
  return mergeProjects(settings.projects, await discoverProjects(settings));
}
