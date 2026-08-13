import { ConfirmModal } from "./tui/components/confirm-modal.tsx";
import { Box, render as inkRender, useWindowSize } from "ink";
import type { ReactElement } from "react";

type ConfirmScreenProps = {
  /** The yes/no question to ask. */
  message: string;
  /** Fires once the user answers, with whether they confirmed. */
  onAnswer: (confirmed: boolean) => void;
};

/** Full-screen shell for {@link ConfirmModal}, which needs a sized parent to anchor to. */
function ConfirmScreen({ message, onAnswer }: ConfirmScreenProps) {
  const { columns, rows } = useWindowSize();

  return (
    <Box width={columns} height={rows}>
      <ConfirmModal message={message} onAnswer={onAnswer} />
    </Box>
  );
}

/** Mounts a React element and returns a handle to unmount it, matching Ink's own `render`. */
type Render = (element: ReactElement) => { unmount: () => void };

/**
 * Asks a yes/no question in the terminal, as an Ink modal. Requires an interactive terminal — check
 * {@link isInteractive} first, since this has no fallback for a non-interactive one.
 *
 * @param message The question to ask.
 * @param render Mounts the confirm screen. Defaults to Ink's own `render`; overridable in tests.
 * @returns Whether the answer was yes.
 */
export async function confirm(message: string, render: Render = inkRender): Promise<boolean> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ConfirmScreen
        message={message}
        onAnswer={(confirmed) => {
          unmount();
          resolve(confirmed);
        }}
      />,
    );
  });
}

/**
 * Reports whether the process is attached to an interactive terminal, which {@link confirm} needs to
 * ask its question.
 *
 * @returns Whether both stdin and stdout are a TTY.
 */
export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}
