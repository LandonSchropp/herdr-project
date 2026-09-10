import { git, stubCommittedRepository } from "../test/helpers/repository.ts";
import { addWorktree, mainCheckoutPath, removeWorktree } from "./git.ts";
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Reports whether a path exists, which is how the removal tests tell a deleted checkout from one
 * Git refused to touch.
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

describe("mainCheckoutPath", () => {
  describe("when the path is a linked worktree", () => {
    it("returns the repository's main checkout", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-main`).toString(36)}-worktree`);
      await git(["-C", root, "worktree", "add", "--quiet", worktree, "-b", "topic"]);

      expect(await mainCheckoutPath(worktree)).toEqual(root);
    });
  });

  describe("when the path is the main checkout", () => {
    it("returns the path itself", async () => {
      const root = await stubCommittedRepository();

      expect(await mainCheckoutPath(root)).toEqual(root);
    });
  });

  describe("when the path is not in a repository", () => {
    it("returns null", async () => {
      expect(
        await mainCheckoutPath(await mkdtemp(join(tmpdir(), "herdr-project-plain-"))),
      ).toBeNull();
    });
  });

  describe("when Git's location variables are in the environment", () => {
    it("drops them so the path decides the repository", async () => {
      const spawn = spyOn(Bun, "spawn").mockReturnValue({
        stdout: new Response("worktree /tmp/repo\n").body,
        exited: Promise.resolve(0),
      } as unknown as ReturnType<typeof Bun.spawn>);

      await mainCheckoutPath("/tmp/repo");

      const { env } = spawn.mock.calls[0]?.[1] as { env: Record<string, string | undefined> };

      expect(Object.keys(env)).not.toContainAnyValues([
        "GIT_DIR",
        "GIT_INDEX_FILE",
        "GIT_WORK_TREE",
      ]);
    });
  });
});

describe("addWorktree", () => {
  describe("when the branch does not exist yet", () => {
    it("creates it", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-new`).toString(36)}-worktree`);

      await addWorktree(root, "topic", worktree);

      expect(await mainCheckoutPath(worktree)).toEqual(root);
    });
  });

  describe("when the branch already exists", () => {
    it("checks it out rather than failing", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-existing`).toString(36)}-worktree`);
      await git(["-C", root, "branch", "topic"]);

      await addWorktree(root, "topic", worktree);

      expect(await mainCheckoutPath(worktree)).toEqual(root);
    });
  });

  describe("when Git refuses", () => {
    it("throws with what Git said", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-twice`).toString(36)}-worktree`);
      await addWorktree(root, "topic", worktree);

      const thrown = await addWorktree(root, "topic", worktree).catch((error: Error) => error);

      expect((thrown as Error).message).toContain("already");
    });
  });
});

describe("removeWorktree", () => {
  describe("when the checkout is clean", () => {
    it("removes it", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-remove`).toString(36)}-worktree`);
      await addWorktree(root, "topic", worktree);

      await removeWorktree(root, worktree);

      expect(await exists(worktree)).toBe(false);
    });
  });

  describe("when the checkout has uncommitted work in it", () => {
    it("refuses rather than deleting it", async () => {
      const root = await stubCommittedRepository();
      const worktree = join(root, "..", `${Bun.hash(`${root}-dirty`).toString(36)}-worktree`);
      await addWorktree(root, "topic", worktree);
      await writeFile(join(worktree, "README.md"), "# Changed\n");

      const thrown = await removeWorktree(root, worktree).catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect(await exists(worktree)).toBe(true);
    });
  });
});
