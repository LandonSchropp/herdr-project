import { runHerdrJson } from "./herdr.ts";
import type { Project } from "./types.ts";
import { createWorktree, listWorktrees, openWorktree } from "./worktrees.ts";

/**
 * Extracts the checkout paths of the worktrees that already have a workspace open. A workspace that
 * isn't backed by a worktree contributes nothing.
 *
 * @param response The parsed JSON response from a workspace listing.
 * @returns The checkout paths, without duplicates.
 */
export function parseOpenCheckoutPaths(response: unknown): string[] {
  const workspaces = (response as { result?: { workspaces?: unknown } })?.result?.workspaces;

  if (!Array.isArray(workspaces)) return [];

  const paths = workspaces.flatMap((entry: unknown) => {
    const path = (entry as { worktree?: { checkout_path?: unknown } })?.worktree?.checkout_path;
    return typeof path === "string" ? [path] : [];
  });

  return [...new Set(paths)];
}

/**
 * Lists the checkout paths that already have a Herdr workspace open, so opening one again — which
 * would lay a second set of tabs into it — can be refused before it happens.
 *
 * @returns The checkout paths of every open worktree workspace.
 */
export async function listOpenCheckoutPaths(): Promise<string[]> {
  return parseOpenCheckoutPaths(await runHerdrJson(["workspace", "list"]));
}

/**
 * Opens an existing worktree into a Herdr workspace. The project's tabs are not laid out here:
 * Herdr emits `workspace.created`, and the plugin's hook lays them in, which covers workspaces
 * Herdr opens on its own as well as the ones opened from here.
 *
 * @param project The project the worktree belongs to.
 * @param path The absolute path to the worktree's checkout.
 * @throws When the worktree already has a workspace open.
 */
export async function openProjectWorktree(
  project: Project,
  path: string,
  label?: string,
): Promise<void> {
  if ((await listOpenCheckoutPaths()).includes(path)) {
    throw new Error(`A workspace is already open for ${path}.`);
  }

  await openWorktree(project.repositoryRoot, path, label);
}

/**
 * Creates a worktree on `branch` and opens it into a Herdr workspace. As with
 * {@link openProjectWorktree}, the workspace's tabs come from the `workspace.created` hook.
 *
 * @param project The project to create the worktree in.
 * @param branch The branch to create the worktree on.
 */
export async function createProjectWorktree(project: Project, branch: string): Promise<void> {
  await createWorktree(project.repositoryRoot, branch);
}

/**
 * Opens the project's main checkout into a Herdr workspace, named after the project. Only the main
 * checkout takes the project's name; a linked worktree keeps the branch name Herdr gives it, which
 * is what distinguishes it in the sidebar.
 *
 * @param project The project to open.
 * @throws When the repository reports no main checkout.
 */
export async function openProjectMain(project: Project): Promise<void> {
  const main = (await listWorktrees(project.repositoryRoot)).find((worktree) => worktree.isMain);

  if (main === undefined) throw new Error(`${project.name} has no main worktree.`);

  await openProjectWorktree(project, main.path, project.name);
}

/**
 * Finds the repository behind a workspace, which is how the new-worktree prompt knows which project
 * it is creating a worktree in.
 *
 * @param workspaceId The workspace to look up.
 * @returns The absolute path to the workspace's repository, or `null` when it has no worktree.
 */
export async function workspaceRepositoryRoot(workspaceId: string): Promise<string | null> {
  const repositoryRoot = (await runHerdrJson(["workspace", "get", workspaceId])) as {
    result?: { workspace?: { worktree?: { repo_root?: unknown } } };
  };

  const root = repositoryRoot?.result?.workspace?.worktree?.repo_root;

  return typeof root === "string" ? root : null;
}
