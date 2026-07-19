import type { Project, Worktree } from "../../types.ts";
import { Picker } from "./picker.tsx";

/**
 * The sentinel row that starts the new-worktree prompt instead of opening an existing worktree. It
 * is prefixed so it reads as an action rather than a branch name.
 */
export const NEW_WORKTREE_OPTION = "+ New worktree…";

type WorktreePickerModalProps = {
  /** The project whose worktrees are listed. */
  project: Project;
  /** The project's worktrees, main checkout first. */
  worktrees: Worktree[];
  /** Fires with the picked worktree. */
  onSelect: (worktree: Worktree) => void;
  /** Fires when the user chooses to create a new worktree. */
  onCreate: () => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * The second step of the flow: pick which of the project's worktrees to open. The repository's main
 * checkout leads the list and is focused by default, and a trailing row starts the new-worktree
 * prompt.
 */
export function WorktreePickerModal({
  project,
  worktrees,
  onSelect,
  onCreate,
  onCancel,
}: WorktreePickerModalProps) {
  /**
   * Opens the worktree matching the picked branch, or starts the new-worktree prompt when the
   * sentinel row is chosen.
   *
   * @param option The picked option.
   */
  function handleSelect(option: string) {
    if (option === NEW_WORKTREE_OPTION) {
      onCreate();
      return;
    }

    const worktree = worktrees.find((entry) => entry.branch === option);
    if (worktree) onSelect(worktree);
  }

  return (
    <Picker
      title={`Open ${project.name}`}
      options={[...worktrees.map((worktree) => worktree.branch), NEW_WORKTREE_OPTION]}
      onSelect={handleSelect}
      onCancel={onCancel}
    />
  );
}
