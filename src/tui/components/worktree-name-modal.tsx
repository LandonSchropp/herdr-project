import type { Project } from "../../types.ts";
import { Prompt } from "./prompt.tsx";
import { Text } from "ink";

type WorktreeNameModalProps = {
  /** The project the worktree is created in. */
  project: Project;
  /** Branches that already have a worktree, rejected as duplicates. */
  existingBranches: string[];
  /** Fires with the validated branch name. */
  onSubmit: (branch: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * The new-worktree prompt. Names the branch the worktree is created on, rejecting blank names and
 * branches that already have a worktree in the project.
 */
export function WorktreeNameModal({
  project,
  existingBranches,
  onSubmit,
  onCancel,
}: WorktreeNameModalProps) {
  return (
    <Prompt
      title="New Worktree"
      message={[
        "What would you like to name the",
        <>
          <Text color="blue">{project.name}</Text> branch?
        </>,
      ]}
      onValidate={(branch) => {
        if (branch.trim() === "") return "Enter a branch name.";

        return existingBranches.includes(branch)
          ? `A worktree for "${branch}"\nalready exists.`
          : null;
      }}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
