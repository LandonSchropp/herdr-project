import { cp, mkdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** The name of the include file a repository keeps in its main checkout. */
export const INCLUDE_FILE_NAME = ".worktreeinclude";

/**
 * Runs a Git command and returns its output.
 *
 * @param args The arguments to pass to `git`.
 * @returns Whatever the command wrote to stdout, or `null` when it exited non-zero.
 */
async function runGit(args: string[]): Promise<string | null> {
  const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "ignore" });
  const [stdout, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    process.exited,
  ]);

  return exitCode === 0 ? stdout : null;
}

/**
 * Reports whether a path exists, whether it is a file or a directory.
 *
 * @param path The path to check.
 * @returns Whether the path exists.
 */
async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

/**
 * The path to the include file shared by every repository, which sits beside Git's own global
 * configuration and honors `XDG_CONFIG_HOME`.
 *
 * @returns The absolute path to the global include file, which need not exist.
 */
export function globalIncludePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME;

  return join(
    configHome !== undefined && configHome !== "" ? configHome : join(homedir(), ".config"),
    "git/worktreeinclude",
  );
}

/**
 * The include files that apply to a repository, in the order Git should read them: the global file
 * first and the repository's own second, so the repository's patterns win where the two disagree
 * and a negated pattern can cancel a global one. Either file may be absent; only the files that
 * exist are returned.
 *
 * @param mainCheckout The absolute path to the repository's main checkout.
 * @returns The absolute paths to the include files that exist.
 */
export async function includeFiles(mainCheckout: string): Promise<string[]> {
  const candidates = [globalIncludePath(), join(mainCheckout, INCLUDE_FILE_NAME)];
  const present = await Promise.all(candidates.map(exists));

  return candidates.filter((_, index) => present[index]);
}

/**
 * Lists the paths in a repository's main checkout that the include files match. Only untracked
 * paths are listed, since a tracked one is already in every worktree, and a matched directory is
 * listed as itself rather than as the files inside it.
 *
 * @param mainCheckout The absolute path to the repository's main checkout.
 * @param includeFiles The include files whose patterns to match, in the order they apply.
 * @returns The matching paths, relative to the main checkout.
 */
export async function listIncludedPaths(
  mainCheckout: string,
  includeFiles: string[],
): Promise<string[]> {
  if (includeFiles.length === 0) return [];

  const stdout = await runGit([
    "-C",
    mainCheckout,
    "ls-files",
    "--others",
    "--ignored",
    "--directory",
    "-z",
    ...includeFiles.map((path) => `--exclude-from=${path}`),
  ]);

  if (stdout === null) return [];

  return stdout
    .split("\0")
    .filter((path) => path !== "")
    .map((path) => (path.endsWith("/") ? path.slice(0, -1) : path));
}

/**
 * Copies the paths a repository's include files match from its main checkout into a worktree, which
 * is how files Git does not track — environment files and the like — reach a worktree that was just
 * created. A path the worktree already has is left alone, so this can run against a worktree that
 * has been worked in without overwriting anything.
 *
 * @param mainCheckout The absolute path to the repository's main checkout.
 * @param worktree The absolute path to the worktree to copy into.
 * @returns The paths that were copied, relative to the main checkout.
 */
export async function copyIncludedPaths(mainCheckout: string, worktree: string): Promise<string[]> {
  const paths = await listIncludedPaths(mainCheckout, await includeFiles(mainCheckout));
  const copied: string[] = [];

  for (const path of paths) {
    const destination = join(worktree, path);

    if (await exists(destination)) continue;

    await mkdir(dirname(destination), { recursive: true });
    await cp(join(mainCheckout, path), destination, { recursive: true });
    copied.push(path);
  }

  return copied;
}

/**
 * Finds the main checkout of the repository a path belongs to, which is where a worktree's
 * untracked files are copied from and where the repository's own include file lives. A linked
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
