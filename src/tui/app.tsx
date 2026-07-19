import { listProjects } from "../projects.ts";
import type { Project, Worktree } from "../types.ts";
import { createProjectWorktree, openProjectWorktree } from "../workspaces.ts";
import { listWorktrees } from "../worktrees.ts";
import { ProjectPickerModal } from "./components/project-picker-modal.tsx";
import { WorktreeNameModal } from "./components/worktree-name-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The picker flow: choose a project, then name the worktree to open it on. The name defaults to the
 * repository's main checkout, so pressing enter twice opens the project where it already sits;
 * naming a branch that has no worktree yet creates one. Escape steps back, and escape from the
 * first step exits.
 */
export function App() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffectAsync(async () => {
    setProjects(await listProjects());
  }, []);

  /**
   * Loads the picked project's worktrees and advances to the naming step.
   *
   * @param picked The picked project.
   */
  async function handleProjectSelect(picked: Project) {
    setProject(picked);

    try {
      setWorktrees(await listWorktrees(picked.repositoryRoot));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /**
   * Opens the named branch: an existing worktree is opened where it sits, and a branch without one
   * gets a worktree created for it. Exits once the workspace is up, surfacing any failure instead
   * of closing silently.
   *
   * @param branch The branch to open the project on.
   */
  async function handleSubmit(branch: string) {
    if (project === null) return;

    const existing = worktrees?.find((worktree) => worktree.branch === branch);

    try {
      if (existing === undefined) await createProjectWorktree(project, branch);
      else await openProjectWorktree(project, existing.path);

      exit();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /** Steps back from the naming prompt to the project picker. */
  function handleCancel() {
    setProject(null);
    setWorktrees(null);
  }

  /**
   * Renders the modal for the current step. The modals position themselves absolutely, so they are
   * returned bare and anchored by the full-screen shell below.
   *
   * @returns The current step's content.
   */
  function content(): ReactNode {
    if (error !== null) return <Text color="red">{error}</Text>;
    if (projects === null) return null;

    if (projects.length === 0) {
      return <Text color="yellow">No projects found. Add a project and try again.</Text>;
    }

    if (project === null) {
      return (
        <ProjectPickerModal
          projects={projects}
          onSelect={(picked) => void handleProjectSelect(picked)}
          onCancel={exit}
        />
      );
    }

    if (worktrees === null) return null;

    return (
      <WorktreeNameModal
        project={project}
        defaultBranch={worktrees.find((worktree) => worktree.isMain)?.branch ?? ""}
        onSubmit={(branch) => void handleSubmit(branch)}
        onCancel={handleCancel}
      />
    );
  }

  // The modals are absolutely positioned overlays, which collapse without a sized parent. This
  // shell fills the terminal so they have a box to center themselves in.
  return (
    <Box width={columns} height={rows}>
      {content()}
    </Box>
  );
}
