import { parseCheckoutPath, parseWorkspace, runHerdrJson } from "./herdr.ts";
import type { Workspace, Worktree } from "./types.ts";

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
 * Opens an existing worktree into a Herdr workspace and focuses it.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param path The absolute path to the worktree's checkout.
 * @param label The workspace's name. Omit to let Herdr name it after the repository.
 * @returns The workspace Herdr opened the worktree into.
 */
export async function openWorktree(
  repositoryRoot: string,
  path: string,
  label?: string,
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
      "--focus",
      "--json",
    ]),
  );
}

/**
 * Creates a new worktree on `branch` and opens it into a Herdr workspace.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param branch The branch to create the worktree on.
 * @returns The workspace Herdr created for the worktree, and the checkout path it was created at.
 * @throws When the response reports no checkout path.
 */
export async function createWorktree(
  repositoryRoot: string,
  branch: string,
): Promise<Workspace & { checkoutPath: string }> {
  const response = await runHerdrJson([
    "worktree",
    "create",
    "--cwd",
    repositoryRoot,
    "--branch",
    branch,
    "--focus",
    "--json",
  ]);

  const checkoutPath = parseCheckoutPath(response);

  if (checkoutPath === null) throw new Error("herdr did not report a checkout path");

  return { ...parseWorkspace(response), checkoutPath };
}
