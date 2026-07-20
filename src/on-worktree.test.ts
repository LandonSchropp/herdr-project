import { stubEnv } from "../test/helpers/env.ts";
import { copyWorktreeIncludes, parseEventWorktreePath } from "./on-worktree.ts";
import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs a Git command against the stub repositories, failing the test when it exits non-zero. The
 * variables Git uses to locate a repository are dropped from the environment: under a Git hook they
 * point at the repository being committed rather than at the stub.
 *
 * @param args The arguments to pass to `git`.
 */
async function git(args: string[]): Promise<void> {
  const env = { ...Bun.env };

  for (const key of ["GIT_DIR", "GIT_INDEX_FILE", "GIT_WORK_TREE"]) delete env[key];

  const process = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe", env });
  const [stderr, exitCode] = await Promise.all([
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) throw new Error(`git ${args.join(" ")} failed: ${stderr}`);
}

/**
 * Creates a Git repository with a commit, an untracked `.env` file, and a `.worktreeinclude` that
 * matches it.
 *
 * @returns The repository's main checkout path.
 */
async function stubRepository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "herdr-project-worktree-hook-")));

  await git(["init", "--quiet", "--initial-branch", "main", root]);
  await writeFile(join(root, ".env"), "SECRET=1\n");
  await writeFile(join(root, ".worktreeinclude"), ".env\n");
  await writeFile(join(root, "README.md"), "# Stub\n");
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

  return root;
}

/**
 * Adds a linked worktree to a repository.
 *
 * @param root The repository's main checkout.
 * @param branch The branch to create the worktree on.
 * @returns The worktree's path.
 */
async function stubWorktree(root: string, branch: string): Promise<string> {
  const path = join(root, "..", `${Bun.hash(`${root}-${branch}`).toString(36)}-worktree`);

  await git(["-C", root, "worktree", "add", "--quiet", path, "-b", branch]);

  return path;
}

/** Points `XDG_CONFIG_HOME` at an empty directory so the real global include file is never read. */
async function stubEmptyGlobalInclude(): Promise<void> {
  stubEnv("XDG_CONFIG_HOME", await mkdtemp(join(tmpdir(), "herdr-project-config-")));
}

describe("parseEventWorktreePath", () => {
  describe("when the payload carries a worktree", () => {
    it("returns its path", () => {
      const json = JSON.stringify({ data: { worktree: { path: "/home/user/Notes" } } });

      expect(parseEventWorktreePath(json)).toEqual("/home/user/Notes");
    });
  });

  describe("when the payload carries no worktree", () => {
    it("returns null", () => {
      expect(parseEventWorktreePath(JSON.stringify({ data: {} }))).toBeNull();
    });
  });

  describe("when the payload is not JSON", () => {
    it("returns null", () => {
      expect(parseEventWorktreePath("{ not json")).toBeNull();
    });
  });

  describe("when there is no payload", () => {
    it("returns null", () => {
      expect(parseEventWorktreePath(undefined)).toBeNull();
    });
  });
});

describe("copyWorktreeIncludes", () => {
  describe("when the worktree's repository has a matching include file", () => {
    it("copies the matched path into the worktree", async () => {
      await stubEmptyGlobalInclude();
      const root = await stubRepository();
      const worktree = await stubWorktree(root, "topic");

      await copyWorktreeIncludes(worktree);

      expect(await Bun.file(join(worktree, ".env")).text()).toEqual("SECRET=1\n");
    });

    it("reports what it copied", async () => {
      await stubEmptyGlobalInclude();
      const root = await stubRepository();
      const worktree = await stubWorktree(root, "reported");

      expect(await copyWorktreeIncludes(worktree)).toContain(".env");
    });
  });

  describe("when nothing matches the include files", () => {
    it("copies nothing", async () => {
      await stubEmptyGlobalInclude();
      const root = await stubRepository();
      await writeFile(join(root, ".worktreeinclude"), "does-not-exist\n");
      const worktree = await stubWorktree(root, "empty");

      await copyWorktreeIncludes(worktree);

      expect(await Bun.file(join(worktree, ".env")).exists()).toBe(false);
    });
  });

  describe("when the path is the repository's main checkout", () => {
    it("leaves it alone, since it is what other worktrees copy from", async () => {
      await stubEmptyGlobalInclude();
      const root = await stubRepository();

      expect(await copyWorktreeIncludes(root)).toContain("main checkout");
    });
  });

  describe("when the path is not in a repository", () => {
    it("reports that there is nothing to do", async () => {
      await stubEmptyGlobalInclude();
      const path = await mkdtemp(join(tmpdir(), "herdr-project-plain-"));

      expect(await copyWorktreeIncludes(path)).toContain("no repository");
    });
  });

  describe("when the worktree already has the path", () => {
    it("leaves the existing file alone", async () => {
      await stubEmptyGlobalInclude();
      const root = await stubRepository();
      const worktree = await stubWorktree(root, "existing");
      await mkdir(worktree, { recursive: true });
      await writeFile(join(worktree, ".env"), "SECRET=mine\n");

      await copyWorktreeIncludes(worktree);

      expect(await Bun.file(join(worktree, ".env")).text()).toEqual("SECRET=mine\n");
    });
  });
});
