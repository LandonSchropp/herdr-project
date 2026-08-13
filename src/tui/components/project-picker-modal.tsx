import type { Project } from "../../types.ts";
import { Picker } from "./picker.tsx";

type ProjectPickerModalProps = {
  /** The projects to choose from, in display order. */
  projects: Project[];
  /** An error from a previous selection, shown below the list rather than replacing it. */
  error?: string | null;
  /** Fires with the picked project. */
  onSelect: (project: Project) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/** Fuzzy-search the available projects and pick one by name. */
export function ProjectPickerModal({
  projects,
  error,
  onSelect,
  onCancel,
}: ProjectPickerModalProps) {
  /**
   * Forwards the project matching the picked name.
   *
   * @param name The picked project name.
   */
  function handleSelect(name: string) {
    const project = projects.find((entry) => entry.name === name);
    if (project) onSelect(project);
  }

  return (
    <Picker
      title="Pick a Project"
      options={projects.map((project) => project.name)}
      error={error}
      onSelect={handleSelect}
      onCancel={onCancel}
    />
  );
}
