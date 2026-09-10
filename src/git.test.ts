import { git, stubCommittedRepository } from "../test/helpers/repository.ts";
import { mainCheckoutPath } from "./git.ts";
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
