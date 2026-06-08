import { addWorktree, branchExists, defaultBranch, worktreeExists } from "../commands/git.ts";
import { startTmuxinatorProject, tmuxinatorProjectExists } from "../commands/tmuxinator.ts";
import { DEFAULT_PROJECT } from "../constants.ts";
import type { ProjectSource } from "../types.ts";
import { sessionId } from "./id.ts";
import { MAIN_SESSION_NAME } from "./main-worktree.ts";
import { worktreePath } from "./paths.ts";
import { sessionFileExists, writeSessionFile } from "./session-file.ts";
import { switchSession } from "./switch.ts";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Creates a new orc session and switches to it. The session named "main" runs on the project's main
 * worktree; every other session gets a dedicated Git worktree, on the session's existing branch if
 * one exists or a new branch off the project's default branch otherwise. The session is recorded so
 * it can be listed and resumed after a restart.
 *
 * @param source The project to create the session in.
 * @param session The session name within the project.
 * @throws If the project's default branch cannot be determined or any underlying operation fails.
 */
export async function createSession(source: ProjectSource, session: string): Promise<void> {
  const sessionDirectory =
    session === MAIN_SESSION_NAME
      ? source.repositoryRoot
      : await createWorktree(source.repositoryRoot, source.name, session);

  if (!(await sessionFileExists(source.name, session))) {
    await writeSessionFile({
      project: source.name,
      session,
      id: sessionId(source.name, session),
      kind: source.kind,
      repositoryRoot: source.repositoryRoot,
      createdAt: new Date(),
    });
  }

  // A tmuxinator project supplies its own window layout. Fall back to the default template for
  // directory projects, which have no config of their own, and for tmuxinator projects whose config
  // has since been deleted — so a stopped session can still be recreated.
  if (source.kind === "tmuxinator" && (await tmuxinatorProjectExists(source.name))) {
    await startTmuxinatorProject(source.name, session, sessionDirectory);
  } else {
    await startTmuxinatorProject(source.name, session, sessionDirectory, DEFAULT_PROJECT);
  }

  await switchSession(source.name, session);
}

/**
 * Creates the session's Git worktree if it does not already exist.
 *
 * @param repositoryRoot The path to the project's main repository.
 * @param project The project name.
 * @param session The session name within the project.
 * @returns The absolute path to the session's worktree.
 */
async function createWorktree(
  repositoryRoot: string,
  project: string,
  session: string,
): Promise<string> {
  const path = worktreePath(project, session);

  if (await worktreeExists(repositoryRoot, path)) {
    return path;
  }

  await mkdir(dirname(path), { recursive: true });

  if (await branchExists(repositoryRoot, session)) {
    await addWorktree(repositoryRoot, path, session);
    return path;
  }

  const branch = await defaultBranch(repositoryRoot);

  if (!branch) {
    throw new Error(`Could not determine default branch for ${repositoryRoot}`);
  }

  await addWorktree(repositoryRoot, path, session, branch);
  return path;
}
