import { Prompt } from "./prompt.tsx";
import { Text } from "ink";

/** Lower kebab case: lowercase letters and digits, separated by single hyphens. */
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type WorktreeNameModalProps = {
  /** The name of the project the worktree is created in. */
  projectName: string;
  /** An error from a previous submission, shown below the input rather than replacing it. */
  error?: string | null;
  /** Fires with the validated branch name. */
  onSubmit: (branch: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * The worktree prompt. The input starts empty, and an empty name submits as `""` rather than being
 * rejected: it is how the caller is asked for the project's main checkout, which is the common case
 * and so deserves the shortest keystroke. A branch that already has a worktree is accepted —
 * opening that worktree is what the caller does with it.
 */
export function WorktreeNameModal({
  projectName,
  error,
  onSubmit,
  onCancel,
}: WorktreeNameModalProps) {
  return (
    <Prompt
      title="Open a Worktree"
      message={[
        <>
          Which <Text color="blue">{projectName}</Text> worktree?
        </>,
        "Leave it empty for the main checkout.",
      ]}
      error={error}
      onValidate={(branch) => {
        if (branch === "") return null;
        if (!KEBAB_CASE.test(branch)) return "Use lower kebab case, like new-feature.";
        return null;
      }}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
