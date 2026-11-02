import { waitFor } from "../../../test/helpers/wait-for.ts";
import { Prompt } from "./prompt.tsx";
import { describe, expect, it, mock } from "bun:test";
import { Box } from "ink";
import { render } from "ink-testing-library";
import type { ReactNode } from "react";

/**
 * Wraps the prompt in a sized viewport so its full-window overlay has a parent to anchor to.
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

const noop = () => {};

describe("Prompt", () => {
  it("renders the message", () => {
    const { lastFrame } = renderInViewport(
      <Prompt message="Session name?" onValidate={() => null} onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("Session name?");
  });

  it("draws the input bar's edges with block elements terminals render themselves", () => {
    const { lastFrame } = renderInViewport(
      <Prompt message="x" onValidate={() => null} onSubmit={noop} onCancel={noop} />,
    );

    // Herdr UI draws U+2580–259F itself but falls back to a font for the Legacy Computing block,
    // which leaves a gap below the bar.
    expect(lastFrame()).toContain("\u{2581}".repeat(36));
    expect(lastFrame()).toContain("\u{2594}".repeat(36));
  });

  describe("when a default value is provided", () => {
    it("renders the default value", () => {
      const { lastFrame } = renderInViewport(
        <Prompt
          message="x"
          defaultValue="main"
          onValidate={() => null}
          onSubmit={noop}
          onCancel={noop}
        />,
      );

      expect(lastFrame()).toContain("main");
    });
  });

  describe("when enter is pressed", () => {
    it("calls onSubmit with the current value", () => {
      const onSubmit = mock(() => {});
      const onCancel = mock(() => {});

      const { stdin } = renderInViewport(
        <Prompt
          message="x"
          defaultValue="main"
          onValidate={() => null}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
      );

      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("main");
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("when onValidate returns an error message", () => {
    it("renders the message below the input and does not call onSubmit", async () => {
      const onValidate = mock(() => "That name is taken");
      const onSubmit = mock(() => {});

      const { lastFrame, stdin } = renderInViewport(
        <Prompt
          message="x"
          defaultValue="main"
          onValidate={onValidate}
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("\r");
      await waitFor(() => lastFrame()?.includes("That name is taken") ?? false);

      expect(onSubmit).not.toHaveBeenCalled();
    });

    describe("when the message spans multiple lines", () => {
      it("centers each line individually", async () => {
        const onValidate = mock(() => 'A session named "main"\nalready exists.');

        const { lastFrame, stdin } = renderInViewport(
          <Prompt message="x" onValidate={onValidate} onSubmit={noop} onCancel={noop} />,
        );

        stdin.write("\r");
        await waitFor(() => lastFrame()?.includes("already exists.") ?? false);

        const rows = (lastFrame() ?? "").split("\n");
        const firstRow = rows.find((row) => row.includes("A session named")) ?? "";
        const secondRow = rows.find((row) => row.includes("already exists.")) ?? "";

        // The shorter second line sits further from the left edge than the first, which only holds
        // when each line is centered on its own rather than the block being centered as a whole.
        expect(secondRow.indexOf("already exists.")).toBeGreaterThan(
          firstRow.indexOf("A session named"),
        );
      });
    });

    describe("when the user edits the input afterwards", () => {
      it("clears the error message", async () => {
        const onValidate = mock(() => "That name is taken");

        const { lastFrame, stdin } = renderInViewport(
          <Prompt
            message="x"
            defaultValue="main"
            onValidate={onValidate}
            onSubmit={noop}
            onCancel={noop}
          />,
        );

        stdin.write("\r");
        await waitFor(() => lastFrame()?.includes("That name is taken") ?? false);

        stdin.write("x");
        await waitFor(() => !(lastFrame()?.includes("That name is taken") ?? false));
      });
    });
  });

  describe("when an external error is given", () => {
    it("renders it below the input", () => {
      const { lastFrame } = renderInViewport(
        <Prompt
          message="x"
          error="A workspace is already open for /tmp/orc."
          onValidate={() => null}
          onSubmit={noop}
          onCancel={noop}
        />,
      );

      expect(lastFrame()).toContain("A workspace is already open");
    });

    it("keeps the input interactive rather than replacing it", () => {
      const onSubmit = mock(() => {});

      const { stdin } = renderInViewport(
        <Prompt
          message="x"
          defaultValue="main"
          error="A workspace is already open for /tmp/orc."
          onValidate={() => null}
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("main");
    });
  });

  describe("when escape is pressed", () => {
    it("calls onCancel", async () => {
      const onSubmit = mock(() => {});
      const onCancel = mock(() => {});

      const { stdin } = renderInViewport(
        <Prompt
          message="x"
          defaultValue="main"
          onValidate={() => null}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />,
      );

      stdin.write(String.fromCharCode(27));
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(onCancel).toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
