import { Box, Text } from "ink";
import type { ReactNode } from "react";

/** Minimum width (in columns) of the bordered modal box, keeping it roomy when content is narrow. */
const MIN_WIDTH = 40;

type ModalProps = {
  /** Optional title rendered at the top of the modal. */
  title?: string;
  /** The content rendered inside the modal frame. */
  children: ReactNode;
};

/**
 * A centered, bordered overlay that floats above the rest of the TUI, leaving the underlying app
 * mounted and visible behind it.
 */
export function Modal({ title, children }: ModalProps) {
  return (
    <Box
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      justifyContent="center"
      alignItems="center"
    >
      <Box>
        <Box
          borderStyle="round"
          borderColor="blue"
          flexDirection="column"
          paddingX={2}
          backgroundColor="default"
          minWidth={MIN_WIDTH}
        >
          {children}
        </Box>
        {title === undefined ? null : (
          <Box position="absolute" top={0} left={0} right={0} justifyContent="center">
            <Text bold>{` ${title} `}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
