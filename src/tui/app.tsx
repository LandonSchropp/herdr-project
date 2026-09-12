import { listProjects } from "../projects.ts";
import type { Project } from "../types.ts";
import { openProject } from "../workspaces.ts";
import { ProjectPickerModal } from "./components/project-picker-modal.tsx";
import { WorktreeNameModal } from "./components/worktree-name-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/**
 * The picker: choose a project, then name the worktree to open it on. An empty name opens the
 * project's main checkout, which is the common case and so costs a single keystroke.
 *
 * Both answers are asked for rather than inferred from the workspace the picker was opened in. A
 * flat workspace is a top-level row with no parent project behind it, so there is nothing to
 * infer.
 */
export function App() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [picked, setPicked] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffectAsync(async () => {
    setProjects(await listProjects());
  }, []);

  /**
   * Opens the picked project and exits, surfacing any failure in the prompt rather than closing
   * silently.
   *
   * @param branch The branch to open on, or an empty string for the main checkout.
   */
  async function handleSubmit(branch: string) {
    if (picked === null) return;

    try {
      await openProject(picked, branch);
      exit();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /**
   * Renders the step the picker is on. The modals position themselves absolutely, so one is
   * returned bare and anchored by the full-screen shell below.
   *
   * @returns The step's content.
   */
  function content(): ReactNode {
    if (projects === null) return null;

    if (projects.length === 0) {
      return <Text color="yellow">No projects found. Add a project and try again.</Text>;
    }

    if (picked === null) {
      return <ProjectPickerModal projects={projects} onSelect={setPicked} onCancel={exit} />;
    }

    // Escape steps back to the project picker rather than closing outright, so picking the wrong
    // project costs one keystroke instead of reopening the picker.
    return (
      <WorktreeNameModal
        projectName={picked.name}
        error={error}
        onSubmit={(branch) => void handleSubmit(branch)}
        onCancel={() => setPicked(null)}
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
