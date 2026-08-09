import { listProjects } from "../projects.ts";
import type { Project } from "../types.ts";
import { createProjectWorktree, workspaceRepositoryRoot } from "../workspaces.ts";
import { WorktreeNameModal } from "./components/worktree-name-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The new-worktree prompt, opened from a workspace. It creates a worktree in that workspace's
 * project, leaving the tabs to the `workspace.created` hook.
 */
export function WorktreeApp() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [project, setProject] = useState<Project | null>(null);
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

      const found = (await listProjects()).find((entry) => entry.repositoryRoot === repositoryRoot);

      if (found === undefined) {
        setError(`No project is configured for ${repositoryRoot}.`);
        return;
      }

      setProject(found);
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
    if (project === null) return;

    try {
      await createProjectWorktree(project, branch);
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
    if (project === null) return null;

    return (
      <WorktreeNameModal
        projectName={project.name}
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
