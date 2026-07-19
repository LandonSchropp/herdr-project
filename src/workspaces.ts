import { applyLayout } from "./layout.ts";
import type { Project } from "./types.ts";
import { createWorktree, listWorktrees, openWorktree } from "./worktrees.ts";

/**
 * Opens an existing worktree into a Herdr workspace and lays the project's tabs into it.
 *
 * @param project The project the worktree belongs to.
 * @param path The absolute path to the worktree's checkout.
 */
export async function openProjectWorktree(project: Project, path: string): Promise<void> {
  await applyLayout(await openWorktree(project.repositoryRoot, path), project.tabs);
}

/**
 * Creates a worktree on `branch` and lays the project's tabs into the workspace Herdr opens for it.
 *
 * @param project The project to create the worktree in.
 * @param branch The branch to create the worktree on.
 */
export async function createProjectWorktree(project: Project, branch: string): Promise<void> {
  await applyLayout(await createWorktree(project.repositoryRoot, branch), project.tabs);
}

/**
 * Opens the project's main checkout into a Herdr workspace and lays its tabs into it.
 *
 * @param project The project to open.
 * @throws When the repository reports no main checkout.
 */
export async function openProjectMain(project: Project): Promise<void> {
  const main = (await listWorktrees(project.repositoryRoot)).find((worktree) => worktree.isMain);

  if (main === undefined) throw new Error(`${project.name} has no main worktree.`);

  await openProjectWorktree(project, main.path);
}
