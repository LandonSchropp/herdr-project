import { stubEnv } from "../test/helpers/env.ts";
import {
  copyIncludedPaths,
  globalIncludePath,
  includeFiles,
  listIncludedPaths,
  mainCheckoutPath,
} from "./worktree-include.ts";
import { describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runs a Git command against the stub repositories, failing the test when it exits non-zero. The
 * variables Git uses to locate a repository are dropped from the environment: under a Git hook — a
 * `pre-commit` run of the suite, say — they point at the repository being committed and send
 * `worktree add` looking for its index inside the stub.
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
 * Creates a Git repository holding an untracked `.env` file, an untracked `node_modules` directory,
 * and a tracked `README.md`, which is what the copying tests sort between.
 *
 * @returns The repository's path, resolved through any symlinks so it matches the paths Git prints.
 */
async function stubRepository(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), "herdr-project-include-")));

  await git(["init", "--quiet", "--initial-branch", "main", root]);
  await writeFile(join(root, ".env"), "SECRET=1\n");
  await writeFile(join(root, "README.md"), "# Stub\n");
  await mkdir(join(root, "node_modules", "left-pad"), { recursive: true });
  await writeFile(join(root, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");

  return root;
}

/**
 * Commits everything tracked in a repository, which `git worktree add` needs before it will create
 * a worktree.
 *
 * @param root The repository to commit in.
 */
async function commitAll(root: string): Promise<void> {
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
 * Writes a repository's own `.worktreeinclude` file.
 *
 * @param root The repository to write the file in.
 * @param contents The patterns to write.
 */
async function stubLocalInclude(root: string, contents: string): Promise<void> {
  await writeFile(join(root, ".worktreeinclude"), contents);
}

/**
 * Points `XDG_CONFIG_HOME` at a temporary directory and writes a global include file into it.
 *
 * @param contents The patterns to write, or `null` to leave the file absent.
 * @returns The configuration directory's path.
 */
async function stubGlobalInclude(contents: string | null): Promise<string> {
  const configHome = await mkdtemp(join(tmpdir(), "herdr-project-config-"));

  stubEnv("XDG_CONFIG_HOME", configHome);

  if (contents !== null) {
    await mkdir(join(configHome, "git"), { recursive: true });
    await writeFile(join(configHome, "git", "worktreeinclude"), contents);
  }

  return configHome;
}

describe("globalIncludePath", () => {
  describe("when XDG_CONFIG_HOME is set", () => {
    it("returns the include file under it", () => {
      stubEnv("XDG_CONFIG_HOME", "/tmp/config");

      expect(globalIncludePath()).toEqual("/tmp/config/git/worktreeinclude");
    });
  });

  describe("when XDG_CONFIG_HOME is unset", () => {
    it("returns the include file under the home configuration directory", () => {
      stubEnv("XDG_CONFIG_HOME", undefined);

      expect(globalIncludePath()).toEqual(join(homedir(), ".config/git/worktreeinclude"));
    });
  });
});

describe("includeFiles", () => {
  describe("when neither file exists", () => {
    it("returns an empty list", async () => {
      await stubGlobalInclude(null);

      expect(await includeFiles(await stubRepository())).toEqual([]);
    });
  });

  describe("when only the global file exists", () => {
    it("returns the global file", async () => {
      const configHome = await stubGlobalInclude(".env\n");

      expect(await includeFiles(await stubRepository())).toEqual([
        join(configHome, "git/worktreeinclude"),
      ]);
    });
  });

  describe("when only the repository's file exists", () => {
    it("returns the repository's file", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      await stubLocalInclude(root, ".env\n");

      expect(await includeFiles(root)).toEqual([join(root, ".worktreeinclude")]);
    });
  });

  describe("when both files exist", () => {
    it("returns the global file first, so the repository's patterns win", async () => {
      const configHome = await stubGlobalInclude(".env\n");
      const root = await stubRepository();
      await stubLocalInclude(root, "!.env\n");

      expect(await includeFiles(root)).toEqual([
        join(configHome, "git/worktreeinclude"),
        join(root, ".worktreeinclude"),
      ]);
    });
  });
});

describe("listIncludedPaths", () => {
  describe("when a pattern matches an untracked file", () => {
    it("returns the file", async () => {
      const root = await stubRepository();
      await stubLocalInclude(root, ".env\n");

      expect(await listIncludedPaths(root, [join(root, ".worktreeinclude")])).toEqual([".env"]);
    });
  });

  describe("when a pattern matches a directory", () => {
    it("returns the directory rather than the files inside it", async () => {
      const root = await stubRepository();
      await stubLocalInclude(root, "node_modules/\n");

      expect(await listIncludedPaths(root, [join(root, ".worktreeinclude")])).toEqual([
        "node_modules",
      ]);
    });
  });

  describe("when a pattern matches a tracked file", () => {
    it("leaves it out, since the worktree already has it", async () => {
      const root = await stubRepository();
      await commitAll(root);
      await stubLocalInclude(root, "README.md\n");

      expect(await listIncludedPaths(root, [join(root, ".worktreeinclude")])).toEqual([]);
    });
  });

  describe("when a later file negates an earlier pattern", () => {
    it("leaves the negated path out", async () => {
      const configHome = await stubGlobalInclude(".env\n");
      const root = await stubRepository();
      await stubLocalInclude(root, "!.env\n");

      const paths = await listIncludedPaths(root, [
        join(configHome, "git/worktreeinclude"),
        join(root, ".worktreeinclude"),
      ]);

      expect(paths).toEqual([]);
    });
  });

  describe("when there are no include files", () => {
    it("returns an empty list", async () => {
      expect(await listIncludedPaths(await stubRepository(), [])).toEqual([]);
    });
  });
});

describe("copyIncludedPaths", () => {
  describe("when a pattern matches an untracked file", () => {
    it("copies it into the worktree", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      await stubLocalInclude(root, ".env\n");
      await commitAll(root);

      const worktree = join(root, "..", `${Bun.hash(root).toString(36)}-worktree`);
      await git(["-C", root, "worktree", "add", "--quiet", worktree, "-b", "topic"]);

      await copyIncludedPaths(root, worktree);

      expect(await Bun.file(join(worktree, ".env")).text()).toEqual("SECRET=1\n");
    });
  });

  describe("when a pattern matches a directory", () => {
    it("copies the directory's contents", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      await stubLocalInclude(root, "node_modules/\n");
      const worktree = await mkdtemp(join(tmpdir(), "herdr-project-worktree-"));

      await copyIncludedPaths(root, worktree);

      expect(await Bun.file(join(worktree, "node_modules/left-pad/index.js")).text()).toEqual(
        "module.exports = 1;\n",
      );
    });
  });

  describe("when the worktree already has the path", () => {
    it("leaves the existing file alone", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      await stubLocalInclude(root, ".env\n");
      const worktree = await mkdtemp(join(tmpdir(), "herdr-project-worktree-"));
      await writeFile(join(worktree, ".env"), "SECRET=mine\n");

      await copyIncludedPaths(root, worktree);

      expect(await Bun.file(join(worktree, ".env")).text()).toEqual("SECRET=mine\n");
    });

    it("leaves it out of the copied paths", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      await stubLocalInclude(root, ".env\n");
      const worktree = await mkdtemp(join(tmpdir(), "herdr-project-worktree-"));
      await writeFile(join(worktree, ".env"), "SECRET=mine\n");

      expect(await copyIncludedPaths(root, worktree)).toEqual([]);
    });
  });

  describe("when there are no include files", () => {
    it("copies nothing", async () => {
      await stubGlobalInclude(null);
      const root = await stubRepository();
      const worktree = await mkdtemp(join(tmpdir(), "herdr-project-worktree-"));

      expect(await copyIncludedPaths(root, worktree)).toEqual([]);
    });
  });
});

describe("mainCheckoutPath", () => {
  describe("when the path is a linked worktree", () => {
    it("returns the repository's main checkout", async () => {
      const root = await stubRepository();
      await commitAll(root);
      const worktree = join(root, "..", `${Bun.hash(`${root}-main`).toString(36)}-worktree`);
      await git(["-C", root, "worktree", "add", "--quiet", worktree, "-b", "topic"]);

      expect(await mainCheckoutPath(worktree)).toEqual(root);
    });
  });

  describe("when the path is the main checkout", () => {
    it("returns the path itself", async () => {
      const root = await stubRepository();
      await commitAll(root);

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
