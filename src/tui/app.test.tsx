import { stubModule } from "../../test/helpers/module.ts";
import { waitFor } from "../../test/helpers/wait-for.ts";
import type { Project } from "../types.ts";
import { App } from "./app.tsx";
import { describe, expect, it, mock } from "bun:test";
import { render } from "ink-testing-library";

const ORC: Project = {
  name: "orc",
  repositoryRoot: "/tmp/orc",
  tabs: [],
  focusedTab: null,
  prompt: null,
};

/**
 * Replaces the modules the picker loads projects from and opens them with, so it can be driven
 * without a running Herdr session.
 *
 * @param projects The projects `listProjects` reports.
 * @returns The mocks standing in for each replaced function.
 */
async function mockAppModules(projects: Project[]) {
  const mocks = {
    listProjects: mock().mockResolvedValue(projects),
    isInRepository: mock().mockResolvedValue(true),
    openProject: mock().mockResolvedValue(undefined),
  };

  await stubModule(import.meta.resolve("../projects.ts"), () => ({
    listProjects: mocks.listProjects,
  }));
  await stubModule(import.meta.resolve("../workspaces.ts"), () => ({
    isInRepository: mocks.isInRepository,
    openProject: mocks.openProject,
  }));

  return mocks;
}

/**
 * Waits for a frame to show some text and for its step to start listening for input.
 *
 * @param lastFrame Returns the most recently rendered frame.
 * @param text The text to wait for.
 */
async function waitForStep(lastFrame: () => string | undefined, text: string): Promise<void> {
  await waitFor(() => lastFrame()?.includes(text) === true);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Renders the picker and waits for its projects to load.
 *
 * @returns The ink-testing-library render result.
 */
async function renderApp() {
  const result = render(<App />);

  await waitForStep(result.lastFrame, "Pick a Project");

  return result;
}

describe("App", () => {
  describe("when there are no projects", () => {
    it("says so", async () => {
      await mockAppModules([]);

      const { lastFrame } = render(<App />);
      await waitFor(() => lastFrame()?.includes("No projects found") === true);

      expect(lastFrame()).toContain("No projects found");
    });
  });

  describe("when a project inside a repository is picked", () => {
    it("asks which worktree to open", async () => {
      await mockAppModules([ORC]);

      const { stdin, lastFrame } = await renderApp();
      stdin.write("\r");
      await waitForStep(lastFrame, "worktree?");

      expect(lastFrame()).toContain("Which orc worktree?");
    });

    it("opens the project on the branch that is named", async () => {
      const mocks = await mockAppModules([ORC]);

      const { stdin, lastFrame } = await renderApp();
      stdin.write("\r");
      await waitForStep(lastFrame, "worktree?");
      stdin.write("feature");
      await waitFor(() => lastFrame()?.includes("feature") === true);
      stdin.write("\r");
      await waitFor(() => mocks.openProject.mock.calls.length > 0);

      expect(mocks.openProject).toHaveBeenCalledWith(ORC, "feature");
    });

    describe("when opening fails", () => {
      it("shows the error", async () => {
        const mocks = await mockAppModules([ORC]);
        mocks.openProject.mockRejectedValue(new Error("already open"));

        const { stdin, lastFrame } = await renderApp();
        stdin.write("\r");
        await waitForStep(lastFrame, "worktree?");
        stdin.write("\r");
        await waitFor(() => lastFrame()?.includes("already open") === true);

        expect(lastFrame()).toContain("already open");
      });

      describe("when escape is pressed", () => {
        it("leaves the error behind", async () => {
          const mocks = await mockAppModules([ORC]);
          mocks.openProject.mockRejectedValue(new Error("already open"));

          const { stdin, lastFrame } = await renderApp();
          stdin.write("\r");
          await waitForStep(lastFrame, "worktree?");
          stdin.write("\r");
          await waitForStep(lastFrame, "already open");
          stdin.write("\u001B");
          await waitForStep(lastFrame, "Pick a Project");

          expect(lastFrame()).not.toContain("already open");
        });
      });
    });

    describe("when escape is pressed", () => {
      it("steps back to the project picker", async () => {
        await mockAppModules([ORC]);

        const { stdin, lastFrame } = await renderApp();
        stdin.write("\r");
        await waitForStep(lastFrame, "worktree?");
        stdin.write("\u001B");
        await waitFor(() => lastFrame()?.includes("Pick a Project") === true);

        expect(lastFrame()).toContain("Pick a Project");
      });
    });
  });

  describe("when a project outside any repository is picked", () => {
    it("opens it without asking for a worktree", async () => {
      const mocks = await mockAppModules([ORC]);
      mocks.isInRepository.mockResolvedValue(false);

      const { stdin, lastFrame } = await renderApp();
      stdin.write("\r");
      await waitFor(() => mocks.openProject.mock.calls.length > 0);

      expect(mocks.openProject).toHaveBeenCalledWith(ORC, "");
      expect(lastFrame()).not.toContain("worktree?");
    });

    describe("when opening fails", () => {
      it("shows the error on the project picker", async () => {
        const mocks = await mockAppModules([ORC]);
        mocks.isInRepository.mockResolvedValue(false);
        mocks.openProject.mockRejectedValue(new Error("already open"));

        const { stdin, lastFrame } = await renderApp();
        stdin.write("\r");
        await waitFor(() => lastFrame()?.includes("already open") === true);

        expect(lastFrame()).toContain("Pick a Project");
        expect(lastFrame()).toContain("already open");
      });
    });
  });
});
