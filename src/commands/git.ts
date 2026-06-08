import { runCommand } from "./shell.ts";

/**
 * Checks if git is installed and available on PATH.
 *
 * @returns `true` when git is installed, otherwise `false`.
 */
export async function isGitInstalled(): Promise<boolean> {
  return (await runCommand(["git", "--version"])).exitCode === 0;
}

/**
 * Returns the default branch for the repo at `repositoryRoot`, or `null` if none can be determined.
 *
 * @param repositoryRoot The path to the git repository.
 * @returns The default branch name, or `null`.
 */
export async function defaultBranch(repositoryRoot: string): Promise<string | null> {
  const originResult = await runCommand([
    "git",
    "-C",
    repositoryRoot,
    "symbolic-ref",
    "refs/remotes/origin/HEAD",
  ]);

  if (originResult.exitCode === 0) {
    return originResult.stdout.trim().split("/").pop() ?? null;
  }

  for (const candidate of ["main", "master"]) {
    const localResult = await runCommand([
      "git",
      "-C",
      repositoryRoot,
      "show-ref",
      "--verify",
      `refs/heads/${candidate}`,
    ]);

    if (localResult.exitCode === 0) return candidate;
  }

  return null;
}

/**
 * Checks whether a local branch named `branch` exists in the repo at `repositoryRoot`.
 *
 * @param repositoryRoot The path to the git repository.
 * @param branch The branch name to look for.
 * @returns `true` when the branch exists, otherwise `false`.
 */
export async function branchExists(repositoryRoot: string, branch: string): Promise<boolean> {
  const { exitCode } = await runCommand([
    "git",
    "-C",
    repositoryRoot,
    "show-ref",
    "--verify",
    "--quiet",
    `refs/heads/${branch}`,
  ]);

  return exitCode === 0;
}

/**
 * Checks whether a git worktree is registered at `worktreePath` for the repo at `repositoryRoot`.
 *
 * @param repositoryRoot The path to the git repository.
 * @param worktreePath The worktree path to look for.
 * @returns `true` when a worktree is registered at the path, otherwise `false`.
 */
export async function worktreeExists(
  repositoryRoot: string,
  worktreePath: string,
): Promise<boolean> {
  const { stdout } = await runCommand([
    "git",
    "-C",
    repositoryRoot,
    "worktree",
    "list",
    "--porcelain",
  ]);

  return stdout.split("\n").some((line) => line === `worktree ${worktreePath}`);
}

/**
 * Creates a git worktree at `worktreePath` for the branch named `branch`. When `baseBranch` is
 * given, creates a new branch based on it; otherwise checks out the existing `branch`.
 *
 * @param repositoryRoot The path to the git repository.
 * @param worktreePath The path where the worktree will be created.
 * @param branch The name of the branch to check out in the worktree.
 * @param baseBranch The branch to base a new branch on. Omit to check out an existing branch.
 * @throws If `git worktree add` fails.
 */
export async function addWorktree(
  repositoryRoot: string,
  worktreePath: string,
  branch: string,
  baseBranch?: string,
): Promise<void> {
  const branchArguments = baseBranch === undefined ? [branch] : ["-b", branch, baseBranch];

  const { exitCode, stderr } = await runCommand([
    "git",
    "-C",
    repositoryRoot,
    "worktree",
    "add",
    worktreePath,
    ...branchArguments,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git worktree add failed: ${stderr.trim()}`);
  }
}

/**
 * Removes the git worktree at `worktreePath`, even when it has untracked or modified files. Leaves
 * the branch in the main repo untouched.
 *
 * @param repositoryRoot The path to the git repository.
 * @param worktreePath The path to the worktree to remove.
 * @throws If the worktree cannot be removed.
 */
export async function removeWorktree(repositoryRoot: string, worktreePath: string): Promise<void> {
  const { exitCode, stderr } = await runCommand([
    "git",
    "-C",
    repositoryRoot,
    "worktree",
    "remove",
    "--force",
    worktreePath,
  ]);

  if (exitCode !== 0) {
    throw new Error(`Failed to remove git worktree: ${stderr.trim()}`);
  }
}
