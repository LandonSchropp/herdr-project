import { Prompt } from "./prompt.tsx";
import { Text } from "ink";

/** Lower kebab case: lowercase letters and digits, separated by single hyphens. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type WorktreeNameModalProps = {
  /** The name of the project the worktree is created in. */
  projectName: string;
  /** Branches that already have a worktree, rejected rather than created a second time. */
  existingBranches: string[];
  /** Fires with the validated branch name. */
  onSubmit: (branch: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * The new-worktree prompt. The input starts empty: unlike the project picker there is no sensible
 * default, since every worktree is a new branch the user is naming.
 */
export function WorktreeNameModal({
  projectName,
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
          <Text color="blue">{projectName}</Text> worktree?
        </>,
      ]}
      onValidate={(branch) => {
        if (branch.trim() === "") return "Enter a branch name.";
        if (!KEBAB_CASE.test(branch)) return "Use lower kebab case, like new-feature.";
        return existingBranches.includes(branch) ? "That worktree already exists." : null;
      }}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
