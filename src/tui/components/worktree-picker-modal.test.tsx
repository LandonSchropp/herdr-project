import type { Project, Worktree } from "../../types.ts";
import { NEW_WORKTREE_OPTION, WorktreePickerModal } from "./worktree-picker-modal.tsx";
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

const MAIN: Worktree = { branch: "main", path: "/home/user/Development/orc", isMain: true };

const LINKED: Worktree = {
  branch: "value-proposition",
  path: "/tmp/worktrees/value-proposition",
  isMain: false,
};

const noop = () => {};

describe("WorktreePickerModal", () => {
  it("renders the project name in the title", () => {
    const { lastFrame } = renderInViewport(
      <WorktreePickerModal
        project={PROJECT}
        worktrees={[MAIN]}
        onSelect={noop}
        onCreate={noop}
        onCancel={noop}
      />,
    );

    expect(lastFrame()).toContain("Open orc");
  });

  it("renders each worktree branch and the new-worktree row", () => {
    const { lastFrame } = renderInViewport(
      <WorktreePickerModal
        project={PROJECT}
        worktrees={[MAIN, LINKED]}
        onSelect={noop}
        onCreate={noop}
        onCancel={noop}
      />,
    );

    const frame = lastFrame();

    expect(frame).toContain("main");
    expect(frame).toContain("value-proposition");
    expect(frame).toContain(NEW_WORKTREE_OPTION);
  });

  describe("when the leading worktree is picked", () => {
    it("calls onSelect with the main worktree", () => {
      const onSelect = mock(() => {});

      const { stdin } = renderInViewport(
        <WorktreePickerModal
          project={PROJECT}
          worktrees={[MAIN, LINKED]}
          onSelect={onSelect}
          onCreate={noop}
          onCancel={noop}
        />,
      );

      stdin.write("\r");

      expect(onSelect).toHaveBeenCalledWith(MAIN);
    });
  });

  describe("when the new-worktree row is picked", () => {
    it("calls onCreate instead of onSelect", () => {
      const onSelect = mock(() => {});
      const onCreate = mock(() => {});

      const { stdin } = renderInViewport(
        <WorktreePickerModal
          project={PROJECT}
          worktrees={[]}
          onSelect={onSelect}
          onCreate={onCreate}
          onCancel={noop}
        />,
      );

      stdin.write("\r");

      expect(onCreate).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });
});
