import { promptWorkspaceAgent } from "./agents.ts";
import { runHerdr } from "./herdr.ts";
import { reportProject } from "./metadata.ts";
import { findOpenWorkspace, listOpenWorkspaces } from "./open-workspaces.ts";
import type { Project } from "./types.ts";
import { createWorktree, listWorktrees, openWorktree } from "./worktrees.ts";

/**
 * Closes a project's main workspace.
 *
 * @param project The project whose main workspace to close.
 * @throws When the repository has no main worktree, or no workspace is open for it.
 */
export async function closeProjectMain(project: Project): Promise<void> {
  const main = (await listWorktrees(project.repositoryRoot)).find((worktree) => worktree.isMain);

  if (main === undefined) throw new Error(`${project.name} has no main worktree.`);

  const workspace = await findOpenWorkspace(main.path);

  if (workspace === null) throw new Error(`${project.name} has no open workspace.`);

  await runHerdr(["workspace", "close", workspace.workspaceId]);
}

/**
 * Removes an open worktree from a project's repository.
 *
 * @param project The project whose worktree to remove.
 * @param branch The branch whose worktree to remove.
 * @throws When the branch has no worktree, or no workspace is open for it.
 */
export async function closeProjectWorktree(project: Project, branch: string): Promise<void> {
  const worktree = (await listWorktrees(project.repositoryRoot)).find(
    (entry) => entry.branch === branch,
  );

  if (worktree === undefined) {
    throw new Error(`${project.name} has no worktree on "${branch}".`);
  }

  const workspace = await findOpenWorkspace(worktree.path);

  if (workspace === null) throw new Error(`"${branch}" has no open workspace.`);

  await runHerdr(["worktree", "remove", "--workspace", workspace.workspaceId]);
}

/**
 * Opens an existing worktree into a Herdr workspace, reporting the project's name and sending its
 * prompt to the agent that starts in it. The project's tabs are laid in by the `workspace.created`
 * hook rather than here.
 *
 * @param project The project the worktree belongs to.
 * @param path The absolute path to the worktree's checkout.
 * @param label The workspace's name. Omit to let Herdr name it after the repository.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the worktree already has a workspace open, or the project's prompt is not delivered.
 */
export async function openProjectWorktree(
  project: Project,
  path: string,
  label?: string,
  focus: boolean = true,
): Promise<void> {
  if ((await findOpenWorkspace(path)) !== null) {
    throw new Error(`A workspace is already open for ${path}.`);
  }

  const { workspaceId } = await openWorktree(project.repositoryRoot, path, label, focus);

  await reportProject(workspaceId, project.name);

  if (project.prompt !== null) await promptWorkspaceAgent(workspaceId, project.prompt);
}

/**
 * Creates a worktree on `branch` and opens it into a Herdr workspace. When the branch already has a
 * worktree, that worktree is opened instead of a second one being created. As with
 * {@link openProjectWorktree}, the project's name is reported here and its tabs are laid in by the
 * `workspace.created` hook.
 *
 * @param project The project to create the worktree in.
 * @param branch The branch to create the worktree on.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the branch's existing worktree already has a workspace open, or the project's prompt
 *   is not delivered.
 */
export async function createProjectWorktree(
  project: Project,
  branch: string,
  focus: boolean = true,
): Promise<void> {
  const existing = (await listWorktrees(project.repositoryRoot)).find(
    (worktree) => worktree.branch === branch,
  );

  if (existing !== undefined) {
    await openProjectWorktree(project, existing.path, undefined, focus);
    return;
  }

  const { workspaceId } = await createWorktree(project.repositoryRoot, branch, focus);

  await reportProject(workspaceId, project.name);

  if (project.prompt !== null) await promptWorkspaceAgent(workspaceId, project.prompt);
}

/**
 * Opens the project's main checkout into a Herdr workspace, named after the project. Only the main
 * checkout takes the project's name; a linked worktree keeps the branch name Herdr gives it, which
 * is what distinguishes it in the sidebar.
 *
 * @param project The project to open.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the repository reports no main checkout, or the project's prompt is not delivered.
 */
export async function openProjectMain(project: Project, focus: boolean = true): Promise<void> {
  const main = (await listWorktrees(project.repositoryRoot)).find((worktree) => worktree.isMain);

  if (main === undefined) throw new Error(`${project.name} has no main worktree.`);

  await openProjectWorktree(project, main.path, project.name, focus);
}

/**
 * Finds the repository behind a workspace, which is how the new-worktree prompt knows which project
 * it is creating a worktree in.
 *
 * @param workspaceId The workspace to look up.
 * @returns The absolute path to the workspace's repository, or `null` when it is showing no
 *   checkout.
 */
export async function workspaceRepositoryRoot(workspaceId: string): Promise<string | null> {
  const workspaces = await listOpenWorkspaces();

  return (
    workspaces.find((workspace) => workspace.workspaceId === workspaceId)?.repositoryRoot ?? null
  );
}
