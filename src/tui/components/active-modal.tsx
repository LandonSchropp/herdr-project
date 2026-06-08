import { useStore } from "../state/store.tsx";
import { DeleteModal } from "./delete-modal.tsx";
import { ProjectPickerModal } from "./project-picker-modal.tsx";
import { SessionNameModal } from "./session-name-modal.tsx";

/**
 * Routes to the modal component matching the store's `activeModal`, or renders nothing when no
 * modal is active.
 */
export function ActiveModal() {
  const { activeModal } = useStore();

  switch (activeModal?.type) {
    case "delete":
      return <DeleteModal />;
    case "project-picker":
      return <ProjectPickerModal />;
    case "session-name":
      return <SessionNameModal />;
    default:
      return null;
  }
}
