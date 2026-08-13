import { ConfirmModal, resolveButtonWidth, resolveShortcut } from "./confirm-modal.tsx";
import { describe, expect, it, mock } from "bun:test";
import { Box } from "ink";
import { render } from "ink-testing-library";
import type { ReactNode } from "react";

/** The raw escape sequence a terminal sends for the left arrow key. */
const LEFT_ARROW = `${String.fromCharCode(27)}[D`;

/** The raw escape sequence a terminal sends for the right arrow key. */
const RIGHT_ARROW = `${String.fromCharCode(27)}[C`;

/** The raw byte a terminal sends for the escape key alone. */
const ESCAPE = String.fromCharCode(27);

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

/**
 * Waits a tick, so a state update from an earlier `stdin.write` lands before the next one — Ink
 * re-registers its input handler on render, and writes issued before that happens read stale
 * state.
 *
 * @returns A promise that resolves after the tick.
 */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

const YES = { name: "Yes" };
const NO = { name: "No" };

describe("resolveShortcut", () => {
  describe("when no shortcut is given", () => {
    it("defaults to the first letter of the name, lowercased", () => {
      expect(resolveShortcut({ name: "Delete" })).toEqual("d");
    });
  });

  describe("when a shortcut is given", () => {
    it("lowercases it", () => {
      expect(resolveShortcut({ name: "Remove", shortcut: "D" })).toEqual("d");
    });
  });

  describe("when the shortcut is 'h'", () => {
    it("throws", () => {
      expect(() => resolveShortcut({ name: "Help" })).toThrow(/h\/l/);
    });
  });

  describe("when the shortcut is 'l'", () => {
    it("throws", () => {
      expect(() => resolveShortcut({ name: "Leave", shortcut: "L" })).toThrow(/h\/l/);
    });
  });
});

describe("resolveButtonWidth", () => {
  describe("when both labels are shorter than the minimum", () => {
    it("returns the minimum", () => {
      const width = resolveButtonWidth({ name: "Yes" }, { name: "No" });
      expect(width).toEqual(resolveButtonWidth({ name: "Yes" }, { name: "Yes" }));
      expect(width).toBeGreaterThanOrEqual("Yes".length);
    });
  });

  describe("when one label is longer than the minimum", () => {
    it("grows to fit it, with padding", () => {
      const short = resolveButtonWidth({ name: "Yes" }, { name: "No" });
      const long = resolveButtonWidth({ name: "Yes" }, { name: "Cancel Everything" });

      expect(long).toBeGreaterThan(short);
      expect(long).toBeGreaterThan("Cancel Everything".length);
    });
  });

  describe("regardless of argument order", () => {
    it("returns the same width", () => {
      expect(resolveButtonWidth({ name: "Yes" }, { name: "Cancel" })).toEqual(
        resolveButtonWidth({ name: "Cancel" }, { name: "Yes" }),
      );
    });
  });
});

describe("ConfirmModal", () => {
  it("renders the title, description, and button labels", () => {
    const { lastFrame } = renderInViewport(
      <ConfirmModal
        title="Close Workspace"
        description="Close orc?"
        confirm={YES}
        deny={NO}
        onAnswer={() => {}}
      />,
    );

    const frame = lastFrame();
    expect(frame).toContain("Close Workspace");
    expect(frame).toContain("Close orc?");
    expect(frame).toContain("Yes");
    expect(frame).toContain("No");
  });

  describe("when the confirm button's shortcut is pressed", () => {
    it("answers true, regardless of focus", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("y");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when the deny button's shortcut is pressed", () => {
    it("answers false", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("n");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when a shortcut is uppercase", () => {
    it("still matches", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("Y");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when enter is pressed with no navigation first", () => {
    it("answers false, since deny is focused by default", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when the left arrow moves focus to confirm, then enter is pressed", () => {
    it("answers true", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write(LEFT_ARROW);
      await tick();
      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when 'h' moves focus to confirm, then enter is pressed", () => {
    it("answers true", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("h");
      await tick();
      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when 'l' moves focus back to deny, then enter is pressed", () => {
    it("answers false", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("h");
      await tick();
      stdin.write("l");
      await tick();
      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when the right arrow is pressed, then enter", () => {
    it("answers false, since deny is already focused by default", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write(RIGHT_ARROW);
      await tick();
      stdin.write("\r");

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when escape is pressed", () => {
    it("answers false", async () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write(ESCAPE);
      await tick();

      expect(onAnswer).toHaveBeenCalledWith(false);
    });
  });

  describe("when a button's explicit shortcut isn't its first letter", () => {
    it("answers with that button when its shortcut is pressed", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal
          title="x"
          description="x"
          confirm={{ name: "Remove", shortcut: "d" }}
          deny={NO}
          onAnswer={onAnswer}
        />,
      );

      stdin.write("d");

      expect(onAnswer).toHaveBeenCalledWith(true);
    });
  });

  describe("when an unrelated key is pressed", () => {
    it("does not answer", () => {
      const onAnswer = mock(() => {});
      const { stdin } = renderInViewport(
        <ConfirmModal title="x" description="x" confirm={YES} deny={NO} onAnswer={onAnswer} />,
      );

      stdin.write("z");

      expect(onAnswer).not.toHaveBeenCalled();
    });
  });
});
