import { ConfirmModal } from "./tui/components/confirm-modal.tsx";
import { Box, render as inkRender, useWindowSize } from "ink";
import type { ReactElement } from "react";

type ConfirmScreenProps = {
  /** Title rendered at the top of the modal. */
  title: string;
  /** Description shown above the buttons. */
  description: string;
  /** Fires once the user answers, with whether they confirmed. */
  onAnswer: (confirmed: boolean) => void;
};

/** Full-screen shell for {@link ConfirmModal}, which needs a sized parent to anchor to. */
function ConfirmScreen({ title, description, onAnswer }: ConfirmScreenProps) {
  const { columns, rows } = useWindowSize();

  return (
    <Box width={columns} height={rows}>
      <ConfirmModal
        title={title}
        description={description}
        confirm={{ name: "Yes" }}
        deny={{ name: "No" }}
        onAnswer={onAnswer}
      />
    </Box>
  );
}

/** Mounts a React element and returns a handle to unmount it, matching Ink's own `render`. */
type Render = (element: ReactElement) => { unmount: () => void };

/**
 * Asks a yes/no question in the terminal, as an Ink modal with Yes/No buttons. Requires an
 * interactive terminal — check {@link isInteractive} first, since this has no fallback for a
 * non-interactive one.
 *
 * @param title The title rendered at the top of the modal.
 * @param description The question to ask, shown above the buttons.
 * @param render Mounts the confirm screen. Defaults to Ink's own `render`; overridable in tests.
 * @returns Whether the answer was yes.
 */
export async function confirm(
  title: string,
  description: string,
  render: Render = inkRender,
): Promise<boolean> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <ConfirmScreen
        title={title}
        description={description}
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
