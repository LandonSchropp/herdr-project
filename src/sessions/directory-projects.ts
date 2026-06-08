import type { ProjectSource } from "../types.ts";
import { safeGlob } from "../utilities/glob.ts";
import { basename, dirname, join } from "node:path";

/**
 * Lists the roots of the git repositories matched by `projectPath`, a glob whose matches are
 * treated as projects when they contain a `.git` entry.
 *
 * @param projectPath The glob to expand.
 * @returns The absolute roots of the matched git repositories.
 */
async function repositoryRoots(projectPath: string): Promise<string[]> {
  const gitEntries = await safeGlob(join(projectPath, ".git"), {
    absolute: true,
    onlyFiles: false,
    dot: true,
  });

  return gitEntries.map(dirname);
}

/**
 * Discovers local git repositories that could back a non-tmuxinator session. Expands each project
 * path glob to the repositories it matches, dropping any whose name matches a tmuxinator project.
 * Each project's name is the repository directory's basename.
 *
 * @param projectPaths The globs to expand into project repositories.
 * @param tmuxinatorSources The existing tmuxinator sources, whose names exclude repositories
 *   already configured in tmuxinator.
 * @returns The discovered directory projects.
 */
export async function listDirectoryProjects(
  projectPaths: string[],
  tmuxinatorSources: ProjectSource[],
): Promise<ProjectSource[]> {
  const tmuxinatorNames = new Set(tmuxinatorSources.map(({ name }) => name));
  const roots = [...new Set((await Promise.all(projectPaths.map(repositoryRoots))).flat())];

  const projects: ProjectSource[] = roots.map((root) => ({
    kind: "directory",
    name: basename(root),
    repositoryRoot: root,
  }));

  return projects.filter((project) => !tmuxinatorNames.has(project.name));
}
