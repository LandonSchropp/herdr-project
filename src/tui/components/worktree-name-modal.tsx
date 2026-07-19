import type { Project } from "../../types.ts";
import { Prompt } from "./prompt.tsx";
import { Text } from "ink";

type WorktreeNameModalProps = {
  /** The project the worktree belongs to. */
  project: Project;
  /**
   * The branch the input is prefilled with, which is the repository's main checkout so that
   * accepting the default opens the project where it already sits.
   */
  defaultBranch: string;
  /** Fires with the branch name to open, which may or may not already have a worktree. */
  onSubmit: (branch: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * The second step of the flow: name the branch to open the project on. The input is prefilled with
 * the repository's main checkout, so pressing enter opens the project as-is; typing another name
 * opens that branch's worktree, creating it when it doesn't exist yet.
 */
export function WorktreeNameModal({
  project,
  defaultBranch,
  onSubmit,
  onCancel,
}: WorktreeNameModalProps) {
  return (
    <Prompt
      title="Open Worktree"
      message={[
        "Which worktree would you like to",
        <>
          open in <Text color="blue">{project.name}</Text>?
        </>,
      ]}
      defaultValue={defaultBranch}
      onValidate={(branch) => (branch.trim() === "" ? "Enter a branch name." : null)}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
