import { listProjectSources } from "../../sessions/project-sources.ts";
import type { ProjectSource } from "../../types.ts";
import { useEffectAsync } from "../hooks/use-effect-async.ts";
import { findProjectContaining } from "../state/find-project-containing.ts";
import { useStore } from "../state/store.tsx";
import { Picker } from "./picker.tsx";
import { useState } from "react";

/**
 * The project-picker modal. Lets the user fuzzy-search the available projects and pick one by name,
 * then advances the new-session flow to the session-name prompt. Pre-selects the project of the
 * currently selected session.
 */
export function ProjectPickerModal() {
  const { selectedSessionId, projects, promptForSession, cancel } = useStore();
  const [sources, setSources] = useState<ProjectSource[] | null>(null);

  useEffectAsync(async () => {
    setSources(await listProjectSources());
  }, []);

  if (sources === null) return null;

  const currentProject = findProjectContaining(projects, selectedSessionId)?.project;

  /**
   * Advances the flow to the session-name prompt for the picked project name.
   *
   * @param name The picked project name.
   */
  function handleSelect(name: string) {
    const source = sources?.find((entry) => entry.name === name);
    if (source) promptForSession(source);
  }

  return (
    <Picker
      title="Pick a Project"
      options={sources.map((source) => source.name)}
      initialSelection={currentProject}
      onSelect={handleSelect}
      onCancel={cancel}
    />
  );
}
