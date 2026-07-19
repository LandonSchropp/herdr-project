import {
  createWorktree,
  listWorktrees,
  openWorktree,
  parseWorktrees,
  sortWorktrees,
} from "./worktrees.ts";
import { describe, expect, it, spyOn } from "bun:test";

const RESPONSE = {
  id: "cli:worktree:list",
  result: {
    type: "worktree_list",
    worktrees: [
      {
        branch: "value-proposition",
        is_linked_worktree: true,
        path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
      },
      {
        branch: "main",
        is_linked_worktree: false,
        path: "/home/user/Development/orc",
      },
    ],
  },
};

describe("parseWorktrees", () => {
  describe("when the response lists worktrees", () => {
    it("returns each worktree with its branch, path, and main flag", () => {
      expect(parseWorktrees(RESPONSE)).toEqual([
        {
          branch: "value-proposition",
          path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
          isMain: false,
        },
        { branch: "main", path: "/home/user/Development/orc", isMain: true },
      ]);
    });
  });

  describe("when a worktree is detached with no branch", () => {
    it("skips it", () => {
      const response = {
        result: { worktrees: [{ is_linked_worktree: true, path: "/tmp/detached" }] },
      };

      expect(parseWorktrees(response)).toEqual([]);
    });
  });

  describe("when the response has no worktrees", () => {
    it("returns an empty list", () => {
      expect(parseWorktrees({ result: { worktrees: [] } })).toEqual([]);
    });
  });

  describe("when the response is not shaped like a worktree list", () => {
    it("returns an empty list", () => {
      expect(parseWorktrees({ nonsense: true })).toEqual([]);
    });
  });
});

describe("sortWorktrees", () => {
  describe("when a main worktree is present", () => {
    it("puts the main worktree first and sorts the rest by branch", () => {
      const worktrees = [
        { branch: "zebra", path: "/tmp/zebra", isMain: false },
        { branch: "main", path: "/tmp/main", isMain: true },
        { branch: "apple", path: "/tmp/apple", isMain: false },
      ];

      expect(sortWorktrees(worktrees).map((worktree) => worktree.branch)).toEqual([
        "main",
        "apple",
        "zebra",
      ]);
    });
  });

  describe("when there is no main worktree", () => {
    it("sorts every worktree by branch", () => {
      const worktrees = [
        { branch: "zebra", path: "/tmp/zebra", isMain: false },
        { branch: "apple", path: "/tmp/apple", isMain: false },
      ];

      expect(sortWorktrees(worktrees).map((worktree) => worktree.branch)).toEqual([
        "apple",
        "zebra",
      ]);
    });
  });
});

/**
 * Mocks `Bun.spawn` so the herdr CLI wrapper can be exercised without a running Herdr session.
 *
 * @param stdout The text the fake process writes to stdout.
 * @param options The exit code and stderr text the fake process reports.
 * @param options.exitCode The code the fake process exits with.
 * @param options.stderr The text the fake process writes to stderr.
 * @returns The spy standing in for `Bun.spawn`.
 */
function mockSpawn(stdout: string, options: { exitCode?: number; stderr?: string } = {}) {
  const { exitCode = 0, stderr = "" } = options;

  return spyOn(Bun, "spawn").mockReturnValue({
    stdout: new Response(stdout).body,
    stderr: new Response(stderr).body,
    exited: Promise.resolve(exitCode),
  } as unknown as ReturnType<typeof Bun.spawn>);
}

describe("listWorktrees", () => {
  describe("when herdr lists worktrees", () => {
    it("returns them with the main worktree first", async () => {
      const spawn = mockSpawn(JSON.stringify(RESPONSE));

      expect(await listWorktrees("/tmp/repo")).toEqual([
        { branch: "main", path: "/home/user/Development/orc", isMain: true },
        {
          branch: "value-proposition",
          path: "/home/user/.cache/orc/worktrees/orc/value-proposition",
          isMain: false,
        },
      ]);

      expect(spawn).toHaveBeenCalledWith(
        ["herdr", "worktree", "list", "--cwd", "/tmp/repo", "--json"],
        expect.anything(),
      );
    });
  });

  describe("when herdr exits non-zero", () => {
    it("throws with the reported error", async () => {
      mockSpawn("", { exitCode: 1, stderr: "not a repository" });

      const thrown = await listWorktrees("/tmp/repo").catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("not a repository");
    });
  });

  describe("when herdr prints something other than JSON", () => {
    it("throws", async () => {
      mockSpawn("not json");

      const thrown = await listWorktrees("/tmp/repo").catch((error: Error) => error);

      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain("did not print JSON");
    });
  });
});

describe("openWorktree", () => {
  it("opens the worktree at the given path", async () => {
    const spawn = mockSpawn("{}");

    await openWorktree("/tmp/repo", "/tmp/worktrees/feature");

    expect(spawn).toHaveBeenCalledWith(
      [
        "herdr",
        "worktree",
        "open",
        "--cwd",
        "/tmp/repo",
        "--path",
        "/tmp/worktrees/feature",
        "--focus",
        "--json",
      ],
      expect.anything(),
    );
  });
});

describe("createWorktree", () => {
  it("creates the worktree on the given branch", async () => {
    const spawn = mockSpawn("{}");

    await createWorktree("/tmp/repo", "feature");

    expect(spawn).toHaveBeenCalledWith(
      [
        "herdr",
        "worktree",
        "create",
        "--cwd",
        "/tmp/repo",
        "--branch",
        "feature",
        "--focus",
        "--json",
      ],
      expect.anything(),
    );
  });
});
