import { mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The variables Git uses to locate a repository, which override the path a command is given. */
const GIT_LOCATION_VARIABLES = ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"];

/**
 * Runs a Git command against a stub repository, failing the test when it exits non-zero. The
 * variables Git uses to locate a repository are dropped from the environment: under a Git hook — a
 * `pre-commit` run of the suite, say — they point at the repository being committed and send
 * `worktree add` looking for its index inside the stub.
 *
 * @param args The arguments to pass to `git`.
 * @throws When the command exits non-zero.
 */
export async function git(args: string[]): Promise<void> {
  const env = { ...Bun.env };

  for (const key of GIT_LOCATION_VARIABLES) delete env[key];

  const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe", env });
  const [stderr, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
}

/**
 * Creates a Git repository in a temporary directory, holding an uncommitted `README.md`.
 *
 * @returns The repository's path, resolved through any symlinks so it matches the paths Git prints.
 */
export async function stubRepository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "herdr-project-repository-")));

  await git(["init", "--quiet", "--initial-branch", "main", root]);
  await writeFile(join(root, "README.md"), "# Stub\n");

  return root;
}

/**
 * Commits everything tracked in a repository, which `git worktree add` needs before it will create
 * a worktree.
 *
 * @param root The repository to commit in.
 */
export async function commitAll(root: string): Promise<void> {
  await git(["-C", root, "add", "README.md"]);
  await git([
    "-C",
    root,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--quiet",
    "--message",
    "Add a README",
  ]);
}

/**
 * Creates a repository with a commit in it, which is the starting point for anything that adds a
 * worktree.
 *
 * @returns The repository's path.
 */
export async function stubCommittedRepository(): Promise<string> {
  const root = await stubRepository();

  await commitAll(root);

  return root;
}
