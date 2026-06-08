import { createSession } from "../../sessions/create.ts";
import { MAIN_SESSION_NAME, isMainWorktree } from "../../sessions/main-worktree.ts";
import { useStore } from "../state/store.tsx";
import { Prompt } from "./prompt.tsx";
import { Text } from "ink";

/**
 * The session-name prompt modal for the picked project. Defaults the name to `"main"` when the
 * project's main worktree is free, and on submit rejects names that already exist in the project;
 * otherwise it closes the modal and creates the session.
 */
export function SessionNameModal() {
  const { activeModal, projects, cancel } = useStore();

  if (activeModal?.type !== "session-name") return null;

  const { source } = activeModal;
  const project = projects.find((entry) => entry.project === source.name);
  const mainInUse = project?.sessions.some(isMainWorktree) ?? false;
  const defaultValue = mainInUse ? "" : MAIN_SESSION_NAME;

  return (
    <Prompt
      title="New Session"
      message={[
        "What would you like to name the",
        <>
          <Text color="blue">{source.name}</Text> session?
        </>,
      ]}
      defaultValue={defaultValue}
      onValidate={(sessionName) => {
        const existingNames = project?.sessions.map((session) => session.session) ?? [];

        return existingNames.includes(sessionName)
          ? `A session named "${sessionName}"\nalready exists.`
          : null;
      }}
      onSubmit={(sessionName) => {
        cancel();
        void createSession(source, sessionName);
      }}
      onCancel={cancel}
    />
  );
}
