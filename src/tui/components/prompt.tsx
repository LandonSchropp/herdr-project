import { Modal } from "./modal.tsx";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Width of the input bar, matched to the Modal's interior (MIN_WIDTH=40 minus its paddingX=2 each
 * side).
 */
const INPUT_WIDTH = 36;

type PromptProps = {
  /** Optional title rendered at the top of the modal. */
  title?: string;
  /**
   * Message shown above the text input. A single node renders as one centered line; an array
   * renders each entry as its own centered line, letting the caller choose wrap points.
   */
  message: ReactNode;
  /** Initial value prefilled into the input. */
  defaultValue?: string;
  /**
   * Validates the input when the user presses enter. Return an error message to render below the
   * input (keeping the modal open and skipping `onSubmit`), or `null` when the value is valid.
   */
  onValidate: (value: string) => string | null;
  /** Fires when the user presses enter with a value that passed validation. */
  onSubmit: (value: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * A text-input modal. Enter submits the current value and escape cancels.
 */
export function Prompt({
  title,
  message,
  defaultValue = "",
  onValidate,
  onSubmit,
  onCancel,
}: PromptProps) {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const lines = Array.isArray(message) ? message : [message];

  useInput((_, key) => {
    if (key.escape) onCancel();
  });

  /**
   * Clears any visible error as the user edits, since the message no longer describes the input.
   *
   * @param next The updated input value.
   */
  function handleChange(next: string) {
    setError(null);
    setValue(next);
  }

  /**
   * Validates the submitted value and either surfaces the validation error below the input or
   * forwards a valid value to `onSubmit`.
   *
   * @param submitted The value entered when the user pressed enter.
   */
  function handleSubmit(submitted: string) {
    const validationError = onValidate(submitted);

    if (validationError !== null) {
      setError(validationError);
      return;
    }

    onSubmit(submitted);
  }

  return (
    <Modal title={title}>
      <Box flexDirection="column" alignItems="center" paddingTop={1}>
        {lines.map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
        <Box width={INPUT_WIDTH} flexDirection="column">
          <Text color="black">{"\u{2582}".repeat(INPUT_WIDTH)}</Text>
          <Box backgroundColor="black" paddingX={1} width="100%">
            <TextInput value={value} onChange={handleChange} onSubmit={handleSubmit} />
          </Box>
          <Text color="black">{"\u{1FB82}".repeat(INPUT_WIDTH)}</Text>
        </Box>
        {error?.split("\n").map((line, index) => (
          <Text key={index} color="red">
            {line}
          </Text>
        ))}
      </Box>
    </Modal>
  );
}
