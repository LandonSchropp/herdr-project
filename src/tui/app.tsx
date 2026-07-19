import { listProjects } from "../projects.ts";
import type { Project, Worktree } from "../types.ts";
import { createWorktree, listWorktrees, openWorktree } from "../worktrees.ts";
import { ProjectPickerModal } from "./components/project-picker-modal.tsx";
import { WorktreeNameModal } from "./components/worktree-name-modal.tsx";
import { WorktreePickerModal } from "./components/worktree-picker-modal.tsx";
import { useEffectAsync } from "./hooks/use-effect-async.ts";
import { Box, Text, useApp, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useState } from "react";

/** Which step of the two-step flow is showing. */
type Step = "project" | "worktree" | "name";

/**
 * The picker flow: choose a project, then choose which of its worktrees to open. Picking an
 * existing worktree opens it into a Herdr workspace; the trailing new-worktree row prompts for a
 * branch name and creates one. Escape steps back, and escape from the first step exits.
 */
export function App() {
  const { exit } = useApp();
  const { columns, rows } = useWindowSize();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [worktrees, setWorktrees] = useState<Worktree[] | null>(null);
  const [step, setStep] = useState<Step>("project");
  const [error, setError] = useState<string | null>(null);

  useEffectAsync(async () => {
    setProjects(await listProjects());
  }, []);

  /**
   * Loads the picked project's worktrees and advances to the worktree step.
   *
   * @param picked The picked project.
   */
  async function handleProjectSelect(picked: Project) {
    setProject(picked);
    setStep("worktree");

    try {
      setWorktrees(await listWorktrees(picked.repositoryRoot));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
  }

  /**
   * Runs a Herdr action and exits, surfacing any failure instead of closing silently.
   *
   * @param action The action to run.
   */
  async function run(action: () => Promise<void>) {
    try {
      await action();
      exit();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    }
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
      return <Text color="yellow">No projects found. Add a project TOML and try again.</Text>;
    }

    if (step === "project" || project === null) {
      return (
        <ProjectPickerModal
          projects={projects}
          onSelect={(picked) => void handleProjectSelect(picked)}
          onCancel={exit}
        />
      );
    }

    if (worktrees === null) return null;

    if (step === "name") {
      return (
        <WorktreeNameModal
          project={project}
          existingBranches={worktrees.map((worktree) => worktree.branch)}
          onSubmit={(branch) => void run(() => createWorktree(project.repositoryRoot, branch))}
          onCancel={() => setStep("worktree")}
        />
      );
    }

    return (
      <WorktreePickerModal
        project={project}
        worktrees={worktrees}
        onSelect={(worktree) => void run(() => openWorktree(project.repositoryRoot, worktree.path))}
        onCreate={() => setStep("name")}
        onCancel={() => setStep("project")}
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
