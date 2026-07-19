import type { Project } from "../../types.ts";
import { Picker } from "./picker.tsx";

type ProjectPickerModalProps = {
  /** The projects to choose from, in display order. */
  projects: Project[];
  /** Fires with the picked project. */
  onSelect: (project: Project) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/** The first step of the flow: fuzzy-search the available projects and pick one by name. */
export function ProjectPickerModal({ projects, onSelect, onCancel }: ProjectPickerModalProps) {
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
      onSelect={handleSelect}
      onCancel={onCancel}
    />
  );
}
