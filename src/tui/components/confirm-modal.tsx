import { Modal } from "./modal.tsx";
import { Box, Text, useInput } from "ink";

type ConfirmModalProps = {
  /** The yes/no question to ask. */
  message: string;
  /** Fires once the user answers, with whether they confirmed. */
  onAnswer: (confirmed: boolean) => void;
};

/** A yes/no modal. "y" confirms; enter, escape, or "n" decline; other keys are ignored. */
export function ConfirmModal({ message, onAnswer }: ConfirmModalProps) {
  useInput((input, key) => {
    if (input.toLowerCase() === "y") onAnswer(true);
    else if (key.return || key.escape || input.toLowerCase() === "n") onAnswer(false);
  });

  return (
    <Modal>
      <Box flexDirection="column" alignItems="center" paddingTop={1}>
        <Text>{message}</Text>
        <Text dimColor>[y/N]</Text>
      </Box>
    </Modal>
  );
}
