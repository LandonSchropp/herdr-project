import { listTmuxinatorProjects } from "../commands/tmuxinator.ts";
import { readSettings } from "../settings/read.ts";
import type { ProjectSource, RootedTmuxinatorProject } from "../types.ts";
import { compareStrings } from "../utilities/string.ts";
import { listDirectoryProjects } from "./directory-projects.ts";

/**
 * Lists the project sources a new session can be created in: the available tmuxinator projects plus
 * the local git repositories matching the configured project paths, sorted together by name.
 * Tmuxinator projects without a root are skipped, since orc needs the root to locate the
 * repository.
 *
 * @returns The available project sources.
 */
export async function listProjectSources(): Promise<ProjectSource[]> {
  const projects = await listTmuxinatorProjects();
  const tmuxinatorSources = projects
    .filter((project): project is RootedTmuxinatorProject => project.root !== null)
    .map(
      (project): ProjectSource => ({
        kind: "tmuxinator",
        name: project.name,
        repositoryRoot: project.root,
      }),
    );

  // A discovered repo that resolves to the same root as a tmuxinator project is the same project;
  // the tmuxinator source wins. Only the directory sources are deduplicated, so multiple tmuxinator
  // projects may share a root.
  const { projectPaths } = await readSettings();
  const tmuxinatorRoots = new Set(tmuxinatorSources.map(({ repositoryRoot }) => repositoryRoot));
  const directorySources = (await listDirectoryProjects(projectPaths, tmuxinatorSources)).filter(
    ({ repositoryRoot }) => !tmuxinatorRoots.has(repositoryRoot),
  );

  return [...tmuxinatorSources, ...directorySources].sort((a, b) => compareStrings(a.name, b.name));
}

/**
 * Finds the project source with the given name among those a new session can be created in.
 *
 * @param name The project name to match.
 * @returns The matching project source, or `null` when no available source has that name.
 */
export async function findProjectSource(name: string): Promise<ProjectSource | null> {
  const sources = await listProjectSources();
  return sources.find((source) => source.name === name) ?? null;
}
