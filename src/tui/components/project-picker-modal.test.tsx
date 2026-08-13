import type { Project } from "../../types.ts";
import { ProjectPickerModal } from "./project-picker-modal.tsx";
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

const ORC: Project = {
  name: "orc",
  repositoryRoot: "/home/user/Development/orc",
  tabs: [],
  focusedTab: null,
};

const NOTES: Project = {
  name: "notes",
  repositoryRoot: "/home/user/Notes",
  tabs: [],
  focusedTab: null,
};

const noop = () => {};

describe("ProjectPickerModal", () => {
  it("renders each project name", () => {
    const { lastFrame } = renderInViewport(
      <ProjectPickerModal projects={[ORC, NOTES]} onSelect={noop} onCancel={noop} />,
    );

    const frame = lastFrame();

    expect(frame).toContain("orc");
    expect(frame).toContain("notes");
  });

  describe("when an error is given", () => {
    it("renders it", () => {
      const { lastFrame } = renderInViewport(
        <ProjectPickerModal
          projects={[ORC]}
          error="A workspace is already open for /home/user/Development/orc."
          onSelect={noop}
          onCancel={noop}
        />,
      );

      expect(lastFrame()).toContain("A workspace is already open");
    });
  });

  describe("when a project is picked", () => {
    it("calls onSelect with the matching project", () => {
      const onSelect = mock(() => {});

      const { stdin } = renderInViewport(
        <ProjectPickerModal projects={[ORC, NOTES]} onSelect={onSelect} onCancel={noop} />,
      );

      stdin.write("\r");

      expect(onSelect).toHaveBeenCalledWith(ORC);
    });
  });
});
