/** The variables Git uses to locate a repository, which override the path a command is given. */
const GIT_LOCATION_VARIABLES = ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"];

/**
 * Runs a Git command. The variables Git uses to locate a repository are dropped from the
 * environment, so the path a command is given decides which repository it acts on — under a Git
 * hook they name the repository being committed and would win over that path.
 *
 * @param args The arguments to pass to `git`.
 * @returns What the command wrote to each stream, and the code it exited with.
 */
async function spawnGit(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const env = { ...Bun.env };

  for (const key of GIT_LOCATION_VARIABLES) delete env[key];

  const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe", env });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  return { stdout, stderr, exitCode };
}

/**
 * Runs a Git command whose failure is an answer rather than a problem, such as asking whether a
 * branch exists.
 *
 * @param args The arguments to pass to `git`.
 * @returns Whatever the command wrote to stdout, or `null` when it exited non-zero.
 */
export async function runGit(args: string[]): Promise<string | null> {
  const { stdout, exitCode } = await spawnGit(args);

  return exitCode === 0 ? stdout : null;
}

/**
 * Runs a Git command whose failure the caller needs to hear about, such as creating or removing a
 * worktree. Git's own message is what gets raised, since it says why far better than we could.
 *
 * @param args The arguments to pass to `git`.
 * @returns Whatever the command wrote to stdout.
 * @throws When the command exits non-zero.
 */
async function runGitOrThrow(args: string[]): Promise<string> {
  const { stdout, stderr, exitCode } = await spawnGit(args);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }

  return stdout;
}

/**
 * Creates a worktree on a branch, which is what Herdr does for a worktree of its own and what the
 * flat path has to do for itself. A branch that already exists is checked out rather than
 * recreated, so a branch left behind by an earlier worktree can be picked back up.
 *
 * @param repositoryRoot The absolute path to the repository to create the worktree in.
 * @param branch The branch to create the worktree on.
 * @param path The absolute path to create the checkout at.
 * @throws When Git refuses, including when the branch is already checked out somewhere else.
 */
export async function addWorktree(
  repositoryRoot: string,
  branch: string,
  path: string,
): Promise<void> {
  const exists =
    (await runGit([
      "-C",
      repositoryRoot,
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${branch}`,
    ])) !== null;

  await runGitOrThrow([
    "-C",
    repositoryRoot,
    "worktree",
    "add",
    ...(exists ? [path, branch] : ["-b", branch, path]),
  ]);
}

/**
 * Finds the main checkout of the repository a path belongs to, which is where a worktree's
 * untracked files are copied from and which identifies the project a checkout belongs to. A linked
 * worktree resolves to its repository's main checkout; the main checkout resolves to itself.
 *
 * @param path The absolute path to a checkout.
 * @returns The absolute path to the main checkout, or `null` when the path is not in a repository.
 */
export async function mainCheckoutPath(path: string): Promise<string | null> {
  const stdout = await runGit(["-C", path, "worktree", "list", "--porcelain"]);
  const first = stdout?.split("\n").find((line) => line.startsWith("worktree "));

  return first === undefined ? null : first.slice("worktree ".length);
}

/**
 * Removes a worktree's checkout, which is what `herdr worktree remove` does for a worktree Herdr
 * manages and what the flat path has to do for itself. Git refuses a checkout holding uncommitted
 * work, which is the guard against deleting something the caller still wants.
 *
 * @param repositoryRoot The absolute path to the repository the worktree belongs to.
 * @param path The absolute path to the checkout to remove.
 * @throws When Git refuses, including when the checkout is not clean.
 */
export async function removeWorktree(repositoryRoot: string, path: string): Promise<void> {
  await runGitOrThrow(["-C", repositoryRoot, "worktree", "remove", path]);
}
