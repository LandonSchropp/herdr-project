import { waitFor } from "../../../test/helpers/wait-for.ts";
import { WorktreeNameModal } from "./worktree-name-modal.tsx";
import { describe, expect, it, mock } from "bun:test";
import { Box } from "ink";
import { render } from "ink-testing-library";
import type { ReactNode } from "react";

/**
 * Wraps the modal in a sized viewport so its full-window overlay has a parent to anchor to.
 *
 * @param children The modal to render.
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

describe("WorktreeNameModal", () => {
  it("renders the project name", () => {
    const { lastFrame } = renderInViewport(
      <WorktreeNameModal projectName="orc" onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("orc");
  });

  it("says what an empty name gets you", () => {
    const { lastFrame } = renderInViewport(
      <WorktreeNameModal projectName="orc" onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("main checkout");
  });

  describe("when the name is left empty", () => {
    it("submits it, since an empty name asks for the main checkout", async () => {
      const onSubmit = mock(() => {});

      const { stdin } = renderInViewport(
        <WorktreeNameModal projectName="orc" onSubmit={onSubmit} onCancel={noop} />,
      );

      stdin.write("\r");
      await waitFor(() => onSubmit.mock.calls.length > 0);

      expect(onSubmit).toHaveBeenCalledWith("");
    });
  });

  describe("when a fresh branch name is submitted", () => {
    it("calls onSubmit with the name", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal projectName="orc" onSubmit={onSubmit} onCancel={noop} />,
      );

      stdin.write("feature");
      await waitFor(() => lastFrame()?.includes("feature") ?? false);
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("feature");
    });
  });

  describe("when the branch name is not lower kebab case", () => {
    it("rejects it instead of submitting", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal projectName="orc" onSubmit={onSubmit} onCancel={noop} />,
      );

      stdin.write("cheat sheet");
      await waitFor(() => lastFrame()?.includes("cheat sheet") ?? false);
      stdin.write("\r");
      await waitFor(() => lastFrame()?.includes("lower kebab case") ?? false);

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("when an error is given", () => {
    it("renders it", () => {
      const { lastFrame } = renderInViewport(
        <WorktreeNameModal
          projectName="orc"
          error="A workspace is already open for /tmp/feature."
          onSubmit={noop}
          onCancel={noop}
        />,
      );

      expect(lastFrame()).toContain("A workspace is already open");
    });
  });

  describe("when the branch already has a worktree", () => {
    it("submits it anyway, so the existing worktree can be opened", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal projectName="orc" onSubmit={onSubmit} onCancel={noop} />,
      );

      stdin.write("main");
      await waitFor(() => lastFrame()?.includes("main") ?? false);
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("main");
    });
  });
});
