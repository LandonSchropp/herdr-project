import { deleteSession } from "../../sessions/delete.ts";
import { findSession } from "../state/find-session.ts";
import { useStore } from "../state/store.tsx";
import { Confirm } from "./confirm.tsx";

/**
 * The delete-confirmation modal for the selected session. Deletes the session on confirm, and
 * dismisses the modal on either path.
 */
export function DeleteModal() {
  const { selectedSessionId, projects, cancel, removeSession } = useStore();
  const session = findSession(projects, selectedSessionId);

  if (!session) return null;

  return (
    <Confirm
      title="Confirm"
      message={`Delete session "${session.session}"?`}
      onYes={() => {
        cancel();
        void deleteSession(session.project, session.session).then(() => {
          removeSession(session.id);
        });
      }}
      onNo={cancel}
    />
  );
}
