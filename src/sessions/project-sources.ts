import { listTmuxinatorProjects, readTmuxinatorProject } from "../commands/tmuxinator.ts";
import { readSettings } from "../settings/read.ts";
import type { ProjectSource } from "../types.ts";
import { compareStrings } from "../utilities/string.ts";
import { listDirectoryProjects } from "./directory-projects.ts";

/**
 * Builds a {@link ProjectSource} for the named tmuxinator project.
 *
 * @param name The tmuxinator project name.
 * @returns The project source, tagged `tmuxinator`.
 */
export async function tmuxinatorSource(name: string): Promise<ProjectSource> {
  const { root } = await readTmuxinatorProject(name);
  return { kind: "tmuxinator", name, repositoryRoot: root };
}

/**
 * Lists the project sources a new session can be created in: the available tmuxinator projects plus
 * the local git repositories matching the configured project paths, sorted together by name.
 *
 * @returns The available project sources.
 */
export async function listProjectSources(): Promise<ProjectSource[]> {
  const { projectPaths } = await readSettings();
  const names = await listTmuxinatorProjects();
  const tmuxinatorSources = await Promise.all(names.map(tmuxinatorSource));

  // A discovered repo that resolves to the same root as a tmuxinator project is the same project;
  // the tmuxinator source wins. Only the directory sources are deduplicated, so multiple tmuxinator
  // projects may share a root.
  const tmuxinatorRoots = new Set(tmuxinatorSources.map(({ repositoryRoot }) => repositoryRoot));
  const directorySources = (await listDirectoryProjects(projectPaths, tmuxinatorSources)).filter(
    ({ repositoryRoot }) => !tmuxinatorRoots.has(repositoryRoot),
  );

  return [...tmuxinatorSources, ...directorySources].sort((a, b) => compareStrings(a.name, b.name));
}
