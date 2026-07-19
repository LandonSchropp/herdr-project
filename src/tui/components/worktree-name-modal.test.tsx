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

const PROJECT: Project = {
  name: "orc",
  repositoryRoot: "/home/user/Development/orc",
  tabs: [],
};

const noop = () => {};

describe("WorktreeNameModal", () => {
  it("renders the project name", () => {
    const { lastFrame } = renderInViewport(
      <WorktreeNameModal project={PROJECT} defaultBranch="main" onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("orc");
  });

  it("prefills the default branch", () => {
    const { lastFrame } = renderInViewport(
      <WorktreeNameModal project={PROJECT} defaultBranch="main" onSubmit={noop} onCancel={noop} />,
    );

    expect(lastFrame()).toContain("main");
  });

  describe("when the prefilled default is accepted", () => {
    it("submits it without any typing", () => {
      const onSubmit = mock(() => {});

      const { stdin } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          defaultBranch="main"
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("main");
    });
  });

  describe("when a branch that already has a worktree is submitted", () => {
    it("submits it rather than rejecting it, so the worktree can be opened", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          defaultBranch=""
          onSubmit={onSubmit}
          onCancel={noop}
        />,
      );

      stdin.write("existing-branch");
      await waitFor(() => lastFrame()?.includes("existing-branch") ?? false);
      stdin.write("\r");

      expect(onSubmit).toHaveBeenCalledWith("existing-branch");
    });
  });

  describe("when the name is blank", () => {
    it("rejects it instead of submitting", async () => {
      const onSubmit = mock(() => {});

      const { stdin, lastFrame } = renderInViewport(
        <WorktreeNameModal
          project={PROJECT}
          defaultBranch=""
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
