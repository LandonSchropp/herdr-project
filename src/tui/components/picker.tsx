import { usePickerKeybindings } from "../hooks/use-picker-keybindings.ts";
import { filterOptions } from "../state/filter-options.ts";
import { Modal } from "./modal.tsx";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { useMemo, useState } from "react";

/**
 * Width of the picker's content area, matched to the Modal's interior (40 minus paddingX=2 each
 * side).
 */
const CONTENT_WIDTH = 36;

/** Number of option rows visible at once; the modal stays this tall regardless of filter results. */
const MAX_VISIBLE_ROWS = 10;

type PickerProps = {
  /** Title rendered at the top of the modal. */
  title: string;
  /** The full list of options, filtered by the user's typed query. */
  options: string[];
  /**
   * Option to focus when the modal first mounts. Falls back to the first option when omitted or
   * when the value isn't in `options`.
   */
  initialSelection?: string;
  /** Fires when the user picks the focused filtered option. */
  onSelect: (value: string) => void;
  /** Fires when the user presses escape. */
  onCancel: () => void;
};

/**
 * Computes the scroll offset that keeps `focusedIndex` centered in the visible window. Clamps to
 * `[0, totalRows - MAX_VISIBLE_ROWS]` so the window never scrolls past the ends.
 *
 * @param focusedIndex The index of the currently focused row.
 * @param totalRows The total number of rows available.
 * @returns The index of the first visible row.
 */
function scrollOffset(focusedIndex: number, totalRows: number): number {
  if (totalRows <= MAX_VISIBLE_ROWS) return 0;
  const center = Math.floor(MAX_VISIBLE_ROWS / 2);
  return Math.max(0, Math.min(focusedIndex - center, totalRows - MAX_VISIBLE_ROWS));
}

/**
 * A snacks-style picker modal. The user types into the search field to filter the list, navigates
 * with arrow keys, picks with enter, and cancels with escape. The list stays a fixed height; when
 * there are more matches than rows, the visible window scrolls to keep focus in view.
 */
export function Picker({ title, options, initialSelection, onSelect, onCancel }: PickerProps) {
  const [query, setQuery] = useState("");
  const filteredOptions = useMemo(() => filterOptions(options, query), [options, query]);
  const initialFocus = Math.max(0, options.indexOf(initialSelection ?? ""));
  const { focusedIndex, resetFocus } = usePickerKeybindings(
    filteredOptions.length,
    onCancel,
    initialFocus,
  );
  const offset = scrollOffset(focusedIndex, filteredOptions.length);
  const visibleOptions = filteredOptions.slice(offset, offset + MAX_VISIBLE_ROWS);

  /**
   * Updates the filter query from a text-input change.
   *
   * @param newValue The new value of the text input.
   */
  function handleChange(newValue: string) {
    newValue = newValue.replace(/\n/g, "");
    if (newValue === query) return;
    setQuery(newValue);
    resetFocus();
  }

  /** Selects the currently focused option, if there is one. */
  function handleSubmit() {
    const choice = filteredOptions[focusedIndex];
    if (choice !== undefined) onSelect(choice);
  }

  return (
    <Modal title={title}>
      <Box flexDirection="column" width={CONTENT_WIDTH} paddingTop={1}>
        <Box justifyContent="space-between">
          <Box>
            <Text color="blue">{"> "}</Text>
            <TextInput value={query} onChange={handleChange} onSubmit={handleSubmit} />
          </Box>
          <Text dimColor>
            {filteredOptions.length}/{options.length}
          </Text>
        </Box>
        <Text dimColor>{"─".repeat(CONTENT_WIDTH)}</Text>
        <Box flexDirection="column" height={MAX_VISIBLE_ROWS}>
          {visibleOptions.map((option, index) => (
            <Box
              key={option}
              backgroundColor={index + offset === focusedIndex ? "gray" : undefined}
              paddingX={1}
            >
              <Text>{option}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Modal>
  );
}
