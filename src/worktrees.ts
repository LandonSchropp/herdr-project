import { addWorktree } from "./git.ts";
import { parseCheckoutPath, parseWorkspace, runHerdrJson } from "./herdr.ts";
import type { Workspace, Worktree } from "./types.ts";
import { copyIncludedPaths } from "./worktree-include.ts";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * Where Herdr keeps the worktrees it creates. Herdr's own `[worktrees] directory` setting can move
 * them, but it isn't readable through its CLI, so the flat path assumes the default.
 */
const WORKTREE_DIRECTORY = ".herdr/worktrees";

/**
 * Extracts the worktrees from a `herdr worktree list --json` response. Detached worktrees have no
 * branch to select or open, so they are skipped. A response that isn't shaped like a worktree list
 * yields an empty list rather than throwing, keeping a surprising payload from crashing the
 * picker.
 *
 * @param response The parsed JSON response.
 * @returns The worktrees described by the response.
 */
export function parseWorktrees(response: unknown): Worktree[] {
  const result = (response as { result?: { worktrees?: unknown } })?.result;

  if (!Array.isArray(result?.worktrees)) return [];

  return result.worktrees.flatMap((entry: unknown) => {
    const worktree = entry as { branch?: unknown; path?: unknown; is_linked_worktree?: unknown };

    if (typeof worktree.branch !== "string" || typeof worktree.path !== "string") return [];

    return [
      {
        branch: worktree.branch,
        path: worktree.path,
        isMain: worktree.is_linked_worktree !== true,
      },
    ];
  });
}

/**
 * Orders worktrees for display: the repository's main checkout leads, since it is the default
 * choice, and the linked worktrees follow alphabetically by branch.
 *
 * @param worktrees The worktrees to sort.
 * @returns A new sorted array.
 */
export function sortWorktrees(worktrees: Worktree[]): Worktree[] {
  return [...worktrees].sort((first, second) => {
    if (first.isMain !== second.isMain) return first.isMain ? -1 : 1;
    return first.branch.localeCompare(second.branch);
  });
}

/**
 * Lists the worktrees of the repository containing `repositoryRoot`.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @returns The repository's worktrees, main checkout first.
 */
export async function listWorktrees(repositoryRoot: string): Promise<Worktree[]> {
  const response = await runHerdrJson(["worktree", "list", "--cwd", repositoryRoot, "--json"]);
  return sortWorktrees(parseWorktrees(response));
}

/**
 * Opens an existing worktree into a Herdr workspace.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param path The absolute path to the worktree's checkout.
 * @param label The workspace's name. Omit to let Herdr name it after the repository.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @returns The workspace Herdr opened the worktree into.
 */
export async function openWorktree(
  repositoryRoot: string,
  path: string,
  label?: string,
  focus: boolean = true,
): Promise<Workspace> {
  return parseWorkspace(
    await runHerdrJson([
      "worktree",
      "open",
      "--cwd",
      repositoryRoot,
      "--path",
      path,
      ...(label === undefined ? [] : ["--label", label]),
      focus ? "--focus" : "--no-focus",
      "--json",
    ]),
  );
}

/**
 * Creates a new worktree on `branch` and opens it into a Herdr workspace.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param branch The branch to create the worktree on.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @returns The workspace Herdr created for the worktree, and the checkout path it was created at.
 * @throws When the response reports no checkout path.
 */
export async function createWorktree(
  repositoryRoot: string,
  branch: string,
  focus: boolean = true,
): Promise<Workspace & { checkoutPath: string }> {
  const response = await runHerdrJson([
    "worktree",
    "create",
    "--cwd",
    repositoryRoot,
    "--branch",
    branch,
    focus ? "--focus" : "--no-focus",
    "--json",
  ]);

  const checkoutPath = parseCheckoutPath(response);

  if (checkoutPath === null) throw new Error("herdr did not report a checkout path");

  return { ...parseWorkspace(response), checkoutPath };
}

/**
 * Where a flat worktree's checkout goes, which is where Herdr would have put it.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param branch The branch the worktree is on.
 * @returns The absolute path to the checkout, which need not exist.
 */
export function flatWorktreePath(repositoryRoot: string, branch: string): string {
  return join(homedir(), WORKTREE_DIRECTORY, basename(repositoryRoot), branch);
}

/**
 * Opens a checkout into a Herdr workspace of its own, without telling Herdr it is a worktree. That
 * is what keeps the workspace a top-level row: Herdr groups a workspace under its repository and
 * opens that repository's main workspace beside it only when it knows the workspace is a worktree.
 *
 * @param checkoutPath The absolute path to the checkout to open.
 * @param label The workspace's name, which Herdr has no worktree to infer one from.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @returns The workspace Herdr created.
 */
export async function openFlatWorkspace(
  checkoutPath: string,
  label: string,
  focus: boolean = true,
): Promise<Workspace> {
  return parseWorkspace(
    await runHerdrJson([
      "workspace",
      "create",
      "--cwd",
      checkoutPath,
      "--label",
      label,
      focus ? "--focus" : "--no-focus",
    ]),
  );
}

/**
 * Creates a worktree on `branch` with Git and opens it as a flat workspace. Herdr never learns the
 * checkout is a worktree, so its `worktree.created` event doesn't fire for it and the repository's
 * include files are copied here instead.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param branch The branch to create the worktree on.
 * @param focus Whether to focus the workspace, leaving the caller where it is when false.
 * @returns The workspace Herdr created, and the checkout path it was created at.
 * @throws When Git will not create the worktree.
 */
export async function createFlatWorktree(
  repositoryRoot: string,
  branch: string,
  focus: boolean = true,
): Promise<Workspace & { checkoutPath: string }> {
  const checkoutPath = flatWorktreePath(repositoryRoot, branch);

  await addWorktree(repositoryRoot, branch, checkoutPath);
  await copyIncludedPaths(repositoryRoot, checkoutPath);

  return { ...(await openFlatWorkspace(checkoutPath, branch, focus)), checkoutPath };
}
