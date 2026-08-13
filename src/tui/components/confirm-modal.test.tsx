import { ConfirmModal } from "./confirm-modal.tsx";
import { describe, expect, it, mock } from "bun:test";
import { Box } from "ink";
import { render } from "ink-testing-library";
import type { ReactNode } from "react";

/**
 * Wraps the modal in a sized viewport so its full-window overlay has a parent to anchor to.
 *
 * @returns The ink-testing-library render result.
 */
function renderInViewport(children: ReactNode) {
  return render(
    <Box width={80} height={20}>
      {children}
    </Box>,
  );
}

describe("ConfirmModal", () => {
  it("renders the message", () => {
    const { lastFrame } = renderInViewport(
      <ConfirmModal message="Close orc?" onAnswer={() => {}} />,
    );

    expect(lastFrame()).toContain("Close orc?");
  });

  describe("when 'y' is pressed", () => {
    it("calls onAnswer with true", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write("y");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when 'Y' is pressed", () => {
    it("calls onAnswer with true", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write("Y");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when 'n' is pressed", () => {
    it("calls onAnswer with false", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write("n");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when enter is pressed", () => {
    it("calls onAnswer with false", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when escape is pressed", () => {
    it("calls onAnswer with false", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write(String.fromCharCode(27));
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when an unrelated key is pressed", () => {
    it("does not call onAnswer", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(<ConfirmModal message="x" onAnswer={onAnswer} />);

      stdin.write("x");

      expect(onAnswer).not.toHaveBeenCalled();
    });
  });
});
