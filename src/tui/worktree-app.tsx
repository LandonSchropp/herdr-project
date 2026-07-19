import { listProjects } from "../projects.ts";
import type { Project, Worktree } from "../types.ts";
import { createProjectWorktree, workspaceRepositoryRoot } from "../workspaces.ts";
import { listWorktrees } from "../worktrees.ts";
import { WorktreeNameModal } from "./components/worktree-name-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/** What the prompt needs to know about the workspace it was opened from. */
type Context = {
  /** The project the current workspace belongs to. */
  project: Project;
  /** The project's existing worktrees, so a duplicate branch can be rejected. */
  worktrees: Worktree[];
};

/**
 * The new-worktree prompt, opened from a workspace. It creates a worktree in that workspace's
 * project, leaving the tabs to the `workspace.created` hook.
 */
export function WorktreeApp() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffectAsync(async () => {
    const workspaceId = process.env.HERDR_WORKSPACE_ID;

    if (workspaceId === undefined || workspaceId === "") {
      setError("Open a workspace first — a worktree is created in its project.");
      return;
    }

    try {
      const repositoryRoot = await workspaceRepositoryRoot(workspaceId);

      if (repositoryRoot === null) {
        setError("This workspace has no repository to create a worktree in.");
        return;
      }

      const project = (await listProjects()).find(
        (entry) => entry.repositoryRoot === repositoryRoot,
      );

      if (project === undefined) {
        setError(`No project is configured for ${repositoryRoot}.`);
        return;
      }

      setContext({ project, worktrees: await listWorktrees(repositoryRoot) });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }, []);

  /**
   * Creates the named worktree and exits, surfacing any failure instead of closing silently.
   *
   * @param branch The branch to create the worktree on.
   */
  async function handleSubmit(branch: string) {
    if (context === null) return;

    try {
      await createProjectWorktree(context.project, branch);
      exit();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /**
   * Renders the prompt. The modal positions itself absolutely, so it is returned bare and anchored
   * by the full-screen shell below.
   *
   * @returns The prompt's content.
   */
  function content(): ReactNode {
    if (error !== null) return <Text color="red">{error}</Text>;
    if (context === null) return null;

    return (
      <WorktreeNameModal
        projectName={context.project.name}
        existingBranches={context.worktrees.map((worktree) => worktree.branch)}
        onSubmit={(branch) => void handleSubmit(branch)}
        onCancel={exit}
      />
    );
  }

  // The modal is an absolutely positioned overlay, which collapses without a sized parent. This
  // shell fills the terminal so it has a box to center itself in.
  return (
    <Box width={columns} height={rows}>
      {content()}
    </Box>
  );
}
