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

/** Horizontal padding inside a button, on each side of its label. */
const BUTTON_PADDING = 2;

/** The minimum interior width of a button, so a short label like "Yes" still gets some heft. */
const MIN_BUTTON_WIDTH = 9;

/**
 * Space between the two buttons. Kept even so the row's total width — twice the (even) shared
 * button width, plus this gap — is also even: against the modal's own even interior width, that
 * splits into equal left/right padding instead of being off by one column.
 */
const BUTTON_GAP = 2;

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

/**
 * Computes the width both buttons share, padded on each side by {@link BUTTON_PADDING} and never
 * below {@link MIN_BUTTON_WIDTH}, so neither button renders narrower than the other.
 *
 * @param confirm The confirming button.
 * @param deny The declining button.
 * @returns The shared button width, in columns.
 */
export function resolveButtonWidth(confirm: ConfirmButton, deny: ConfirmButton): number {
  return Math.max(
    MIN_BUTTON_WIDTH,
    confirm.name.length + BUTTON_PADDING * 2,
    deny.name.length + BUTTON_PADDING * 2,
  );
}

type ButtonLabelProps = {
  /** The button to render. */
  button: ConfirmButton;
  /** The button's resolved shortcut key. */
  shortcut: string;
  /** Whether the button currently has focus. */
  selected: boolean;
  /** The width every button shares, from {@link resolveButtonWidth}. */
  width: number;
};

/**
 * A button's label with its shortcut letter underlined, always on a background — inverted when it
 * has focus, dimmer otherwise. Falls back to a plain label when the shortcut isn't actually one of
 * its letters.
 */
function ButtonLabel({ button, shortcut, selected, width }: ButtonLabelProps) {
  const index = button.name.toLowerCase().indexOf(shortcut);
  const before = index === -1 ? button.name : button.name.slice(0, index);
  const letter = index === -1 ? "" : button.name[index];
  const after = index === -1 ? "" : button.name.slice(index + 1);

  return (
    <Box width={width} justifyContent="center" backgroundColor={selected ? "white" : "gray"}>
      <Text color={selected ? "black" : "white"}>
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
  const buttonWidth = resolveButtonWidth(confirm, deny);
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
        <Text color="gray">{description}</Text>
        <Box marginTop={1} gap={BUTTON_GAP}>
          <ButtonLabel
            button={confirm}
            shortcut={confirmShortcut}
            selected={selected === "confirm"}
            width={buttonWidth}
          />
          <ButtonLabel
            button={deny}
            shortcut={denyShortcut}
            selected={selected === "deny"}
            width={buttonWidth}
          />
        </Box>
      </Box>
    </Modal>
  );
}
