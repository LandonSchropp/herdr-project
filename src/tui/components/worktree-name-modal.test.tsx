import { waitFor } from "../../../test/helpers/wait-for.ts";
import type { Project } from "../../types.ts";
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

const PROJECT: Project = { name: "orc", repositoryRoot: "/home/user/Development/orc" };

const noop = () => {};

describe("WorktreeNameModal", () => {
  it("renders the project name", () => {
    const { lastFrame } = renderInViewport(
      <WorktreeNameModal project={PROJECT} existingBranches={[]} onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("orc");
  });

  describe("when a fresh branch name is submitted", () => {
    it("calls onSubmit with the name", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          existingBranches={["main"]}
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("feature");
      await waitFor(() => lastFrame()?.includes("feature") ?? false);
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("feature");
    });
  });

  describe("when the branch already has a worktree", () => {
    it("rejects the name instead of submitting", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          existingBranches={["main"]}
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("main");
      await waitFor(() => lastFrame()?.includes("main") ?? false);
      stdin.write("\r");
      await waitFor(() => lastFrame()?.includes("already exists.") ?? false);

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("when the name is blank", () => {
    it("rejects it instead of submitting", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          existingBranches={[]}
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("\r");
      await waitFor(() => lastFrame()?.includes("Enter a branch name.") ?? false);

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
