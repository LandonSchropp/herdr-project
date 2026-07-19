import { listProjects } from "../projects.ts";
import type { Project } from "../types.ts";
import { openProjectMain } from "../workspaces.ts";
import { ProjectPickerModal } from "./components/project-picker-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The project picker: choose a project and it opens on its main checkout, which is where Herdr
 * expects work to start. Linked worktrees are created separately, from the new-worktree prompt.
 */
export function App() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffectAsync(async () => {
    setProjects(await listProjects());
  }, []);

  /**
   * Opens the picked project on its main checkout and exits, surfacing any failure instead of
   * closing silently.
   *
   * @param project The picked project.
   */
  async function handleSelect(project: Project) {
    try {
      await openProjectMain(project);
      exit();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /**
   * Renders the picker. The modal positions itself absolutely, so it is returned bare and anchored
   * by the full-screen shell below.
   *
   * @returns The picker's content.
   */
  function content(): ReactNode {
    if (error !== null) return <Text color="red">{error}</Text>;
    if (projects === null) return null;

    if (projects.length === 0) {
      return <Text color="yellow">No projects found. Add a project and try again.</Text>;
    }

    return (
      <ProjectPickerModal
        projects={projects}
        onSelect={(project) => void handleSelect(project)}
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
