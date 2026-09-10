/** The variables Git uses to locate a repository, which override the path a command is given. */
const GIT_LOCATION_VARIABLES = ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"];

/**
 * Runs a Git command and returns its output. The variables Git uses to locate a repository are
 * dropped from the environment, so the path a command is given decides which repository it acts on
 * — under a Git hook they name the repository being committed and would win over that path.
 *
 * @param args The arguments to pass to `git`.
 * @returns Whatever the command wrote to stdout, or `null` when it exited non-zero.
 */
export async function runGit(args: string[]): Promise<string | null> {
  const env = { ...Bun.env };

  for (const key of GIT_LOCATION_VARIABLES) delete env[key];

  const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "ignore", env });
  const [stdout, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    process.exited,
  ]);

  return exitCode === 0 ? stdout : null;
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
