import type { Worktree } from "./types.ts";

/**
 * Runs a `herdr` CLI command that prints JSON and returns the parsed response.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @returns The parsed JSON response.
 * @throws When the command exits non-zero or prints output that is not JSON.
 */
async function runHerdr(args: string[]): Promise<unknown> {
  const process = Bun.spawn(["herdr", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`herdr ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`herdr ${args.join(" ")} did not print JSON: ${stdout.trim()}`);
  }
}

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
  const response = await runHerdr(["worktree", "list", "--cwd", repositoryRoot, "--json"]);
  return sortWorktrees(parseWorktrees(response));
}

/**
 * Opens an existing worktree into a Herdr workspace and focuses it.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param path The absolute path to the worktree's checkout.
 */
export async function openWorktree(repositoryRoot: string, path: string): Promise<void> {
  await runHerdr([
    "worktree",
    "open",
    "--cwd",
    repositoryRoot,
    "--path",
    path,
    "--focus",
    "--json",
  ]);
}

/**
 * Creates a new worktree on `branch` and opens it into a Herdr workspace.
 *
 * @param repositoryRoot The absolute path to the project's repository.
 * @param branch The branch to create the worktree on.
 */
export async function createWorktree(repositoryRoot: string, branch: string): Promise<void> {
  await runHerdr([
    "worktree",
    "create",
    "--cwd",
    repositoryRoot,
    "--branch",
    branch,
    "--focus",
    "--json",
  ]);
}
