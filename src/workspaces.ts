import { promptWorkspaceAgent } from "./agents.ts";
import { mainCheckoutPath, removeWorktree } from "./git.ts";
import { runHerdr } from "./herdr.ts";
import { reportProject } from "./metadata.ts";
import { findOpenWorkspace, listOpenWorkspaces } from "./open-workspaces.ts";
import { loadSettings } from "./settings.ts";
import type { Project, Workspace } from "./types.ts";
import {
  createFlatWorktree,
  createWorktree,
  listWorktrees,
  openFlatWorkspace,
  openWorktree,
} from "./worktrees.ts";
import { basename } from "node:path";

/**
 * Reports whether a project's path is inside a Git repository.
 *
 * @param project The project to check.
 * @returns Whether the project's path is inside a repository.
 */
export async function isInRepository(project: Project): Promise<boolean> {
  return (await mainCheckoutPath(project.repositoryRoot)) !== null;
}

/**
 * Closes one of a project's main workspaces, which for a project outside any repository are the
 * workspaces open on its directory.
 *
 * @param project The project whose main workspace to close.
 * @param label The label of the workspace to close. Omit to close the only one open, or when
 *   several are, the one named after the project.
 * @throws When the repository has no main worktree, or no single open workspace matches.
 */
export async function closeProjectMain(project: Project, label?: string): Promise<void> {
  const { path } = await findMainCheckout(project);
  const open = (await listOpenWorkspaces()).filter((workspace) => workspace.checkoutPath === path);
  const named = (name: string) => open.filter((workspace) => workspace.label === name);
  const workspaces =
    label !== undefined ? named(label) : open.length > 1 ? named(project.name) : open;

  if (workspaces.length === 1) {
    await runHerdr(["workspace", "close", workspaces[0].workspaceId]);
    return;
  }

  if (workspaces.length > 1 || (label === undefined && open.length > 1)) {
    throw new Error(`${project.name} has several open workspaces; name the one to close.`);
  }

  const suffix = label === undefined ? "" : ` named "${label}"`;
  throw new Error(`${project.name} has no open workspace${suffix}.`);
}

/**
 * Removes an open worktree from a project's repository, deleting its checkout along with the
 * workspace showing it.
 *
 * How that happens depends on what Herdr knows about the workspace rather than on the current
 * settings, so a workspace opened before `flat` was turned on still closes the way it was opened.
 * Herdr removes a worktree of its own; a flat one is removed with Git, which refuses a checkout
 * holding uncommitted work and leaves the workspace open when it does.
 *
 * @param project The project whose worktree to remove.
 * @param branch The branch whose worktree to remove.
 * @throws When the branch has no worktree, no workspace is open for it, or the checkout is not
 *   clean.
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

  if (workspace.isManagedWorktree) {
    await runHerdr(["worktree", "remove", "--workspace", workspace.workspaceId]);
    return;
  }

  await removeWorktree(project.repositoryRoot, worktree.path);
  await runHerdr(["workspace", "close", workspace.workspaceId]);
}

/**
 * Opens a workspace, reports the project's name, and sends the project's prompt to the agent that
 * starts in it.
 *
 * @param project The project being opened, whose name and prompt are sent once the workspace opens.
 * @param open Opens the workspace.
 * @throws When the project's prompt is not delivered.
 */
async function openIntoWorkspace(project: Project, open: () => Promise<Workspace>): Promise<void> {
  const { workspaceId } = await open();

  await reportProject(workspaceId, project.name);

  if (project.prompt !== null) await promptWorkspaceAgent(workspaceId, project.prompt);
}

/**
 * Opens an existing worktree into a Herdr workspace, reporting the project's name and sending its
 * prompt to the agent that starts in it. The project's tabs are laid in by the `workspace.created`
 * hook rather than here.
 *
 * @param project The project the worktree belongs to.
 * @param path The absolute path to the worktree's checkout.
 * @param label The workspace's name. Omit to let Herdr name it after the repository, or — with
 *   `flat`, where Herdr has no worktree to name it after — after the checkout's own directory,
 *   which for a worktree this plugin created is its branch.
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

  const flat = (await loadSettings()).flat;

  await openIntoWorkspace(project, () =>
    flat
      ? openFlatWorkspace(path, label ?? basename(path), focus)
      : openWorktree(project.repositoryRoot, path, label, focus),
  );
}

/**
 * Creates a worktree on `branch` and opens it into a Herdr workspace. When the branch already has a
 * worktree, that worktree is opened instead of a second one being created. As with
 * {@link openProjectWorktree}, the project's name is reported here and its tabs are laid in by the
 * `workspace.created` hook.
 *
 * @param project The project to create the worktree in.
 * @param branch The branch to create the worktree on.
 * @param label The workspace's name. Omit to let it default to the branch, or — when the branch
 *   already has an open worktree — to {@link openProjectWorktree}'s own default instead.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the project is outside any repository, the branch's existing worktree already has a
 *   workspace open, or the project's prompt is not delivered.
 */
export async function createProjectWorktree(
  project: Project,
  branch: string,
  label?: string,
  focus: boolean = true,
): Promise<void> {
  if (!(await isInRepository(project))) {
    throw new Error(`${project.name} is not in a Git repository, so it has no worktrees.`);
  }

  const existing = (await listWorktrees(project.repositoryRoot)).find(
    (worktree) => worktree.branch === branch,
  );

  if (existing !== undefined) {
    await openProjectWorktree(project, existing.path, label, focus);
    return;
  }

  const { workspaceId } = (await loadSettings()).flat
    ? await createFlatWorktree(project.repositoryRoot, branch, label, focus)
    : await createWorktree(project.repositoryRoot, branch, label, focus);

  await reportProject(workspaceId, project.name);

  if (project.prompt !== null) await promptWorkspaceAgent(workspaceId, project.prompt);
}

/**
 * Finds a project's main checkout, which for a project outside any repository is its directory.
 *
 * @param project The project whose main checkout to find.
 * @returns The checkout's absolute path, and whether Herdr can open it as a worktree, which it
 *   cannot for a bare repository's main checkout or a directory outside any repository.
 * @throws When the repository reports no main worktree.
 */
async function findMainCheckout(project: Project): Promise<{ path: string; isWorktree: boolean }> {
  if (!(await isInRepository(project))) return { path: project.repositoryRoot, isWorktree: false };

  const main = (await listWorktrees(project.repositoryRoot)).find((worktree) => worktree.isMain);

  if (main === undefined) throw new Error(`${project.name} has no main worktree.`);

  return { path: main.path, isWorktree: !main.isBare };
}

/**
 * Opens the project's main checkout into a Herdr workspace, named after the project.
 *
 * The main checkout can have several workspaces open at once, told apart by their labels, so
 * opening it again under a new label opens another workspace beside the first. That one, a bare
 * repository's main checkout, and the directory of a project outside any repository, open as plain
 * workspaces.
 *
 * @param project The project to open.
 * @param label The workspace's name. Omit to name it after the project.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the repository reports no main checkout, a workspace with the same name is already
 *   open on it, or the project's prompt is not delivered.
 */
export async function openProjectMain(
  project: Project,
  label?: string,
  focus: boolean = true,
): Promise<void> {
  const name = label ?? project.name;
  const { path, isWorktree } = await findMainCheckout(project);
  const open = (await listOpenWorkspaces()).filter((workspace) => workspace.checkoutPath === path);

  if (open.some((workspace) => workspace.label === name)) {
    throw new Error(`A workspace named "${name}" is already open for ${path}.`);
  }

  const plain = !isWorktree || open.length > 0 || (await loadSettings()).flat;

  await openIntoWorkspace(project, () =>
    plain
      ? openFlatWorkspace(path, name, focus)
      : openWorktree(project.repositoryRoot, path, name, focus),
  );
}

/**
 * Opens a project on a branch, which is what both front ends do once they know which project and
 * which worktree the user asked for. An empty branch asks for the project's main checkout, since
 * that is what a caller means when it has no branch to offer.
 *
 * @param project The project to open.
 * @param branch The branch whose worktree to open, or an empty string for the main checkout.
 * @param label The workspace's name, overriding the default for either case above.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @throws When the workspace is already open, or the project's prompt is not delivered.
 */
export async function openProject(
  project: Project,
  branch: string,
  label?: string,
  focus: boolean = true,
): Promise<void> {
  if (branch === "") await openProjectMain(project, label, focus);
  else await createProjectWorktree(project, branch, label, focus);
}
