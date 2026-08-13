import { Modal } from "./modal.tsx";
import { Box, Text, useInput } from "ink";
import { useState } from "react";

/** A button in a {@link ConfirmModal}. */
export type ConfirmButton = {
  /** The button's label. */
  name: string;
  /**
   * The key that activates this button, case-insensitive. Defaults to the first letter of `name`.
   * Must not be "h" or "l" — those move focus between the buttons instead.
   */
  shortcut?: string;
};

type ConfirmModalProps = {
  /** Title rendered at the top of the modal. */
  title: string;
  /** Description shown above the buttons. */
  description: string;
  /** The confirming button. */
  confirm: ConfirmButton;
  /** The declining button. */
  deny: ConfirmButton;
  /** Fires once the user picks a button, with whether it was `confirm`. */
  onAnswer: (confirmed: boolean) => void;
};

/**
 * Resolves a button's shortcut key, defaulting to the first letter of its name.
 *
 * @param button The button to resolve a shortcut for.
 * @returns The shortcut key, lowercased.
 * @throws When the shortcut is "h" or "l", which move focus between the buttons instead.
 */
export function resolveShortcut(button: ConfirmButton): string {
  const shortcut = (button.shortcut ?? button.name[0] ?? "").toLowerCase();

  if (shortcut === "h" || shortcut === "l") {
    throw new Error(`"${button.name}" cannot use "${shortcut}" as a shortcut — h/l navigate.`);
  }

  return shortcut;
}

type ButtonLabelProps = {
  /** The button to render. */
  button: ConfirmButton;
  /** The button's resolved shortcut key. */
  shortcut: string;
  /** Whether the button currently has focus. */
  selected: boolean;
};

/**
 * A button's label with its shortcut letter underlined, inverted when it has focus. Falls back to a
 * plain label when the shortcut isn't actually one of its letters.
 */
function ButtonLabel({ button, shortcut, selected }: ButtonLabelProps) {
  const index = button.name.toLowerCase().indexOf(shortcut);
  const before = index === -1 ? button.name : button.name.slice(0, index);
  const letter = index === -1 ? "" : button.name[index];
  const after = index === -1 ? "" : button.name.slice(index + 1);

  return (
    <Box paddingX={1} backgroundColor={selected ? "white" : undefined}>
      <Text color={selected ? "black" : undefined}>
        {before}
        <Text underline>{letter}</Text>
        {after}
      </Text>
    </Box>
  );
}

/**
 * A two-button modal. Left/right arrows or "h"/"l" move focus between the buttons, enter picks the
 * focused one, escape declines, and each button's own shortcut picks it directly regardless of
 * focus.
 */
export function ConfirmModal({ title, description, confirm, deny, onAnswer }: ConfirmModalProps) {
  const confirmShortcut = resolveShortcut(confirm);
  const denyShortcut = resolveShortcut(deny);
  const [selected, setSelected] = useState<"confirm" | "deny">("deny");

  useInput((input, key) => {
    const lower = input.toLowerCase();

    if (key.leftArrow || lower === "h") setSelected("confirm");
    else if (key.rightArrow || lower === "l") setSelected("deny");
    else if (key.escape) onAnswer(false);
    else if (key.return) onAnswer(selected === "confirm");
    else if (lower === confirmShortcut) onAnswer(true);
    else if (lower === denyShortcut) onAnswer(false);
  });

  return (
    <Modal title={title}>
      <Box flexDirection="column" alignItems="center" paddingTop={1}>
        <Text>{description}</Text>
        <Box marginTop={1} gap={1}>
          <ButtonLabel
            button={confirm}
            shortcut={confirmShortcut}
            selected={selected === "confirm"}
          />
          <ButtonLabel button={deny} shortcut={denyShortcut} selected={selected === "deny"} />
        </Box>
      </Box>
    </Modal>
  );
}
