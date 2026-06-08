import type { ProjectSource } from "../types.ts";
import { listProjectSources, tmuxinatorSource } from "./project-sources.ts";
import { describe, expect, it, mock } from "bun:test";

const listTmuxinatorProjectsMock = mock<() => Promise<string[]>>(() => Promise.resolve([]));
const readTmuxinatorProjectMock = mock<(name: string) => Promise<{ root: string }>>(() =>
  Promise.resolve({ root: "" }),
);
const listDirectoryProjectsMock = mock<
  (projectPaths: string[], sources: ProjectSource[]) => Promise<ProjectSource[]>
>(() => Promise.resolve([]));
const readSettingsMock = mock<() => Promise<{ projectPaths: string[] }>>(() =>
  Promise.resolve({ projectPaths: [] }),
);

await mock.module("../commands/tmuxinator.ts", () => ({
  listTmuxinatorProjects: listTmuxinatorProjectsMock,
  readTmuxinatorProject: readTmuxinatorProjectMock,
}));

await mock.module("./directory-projects.ts", () => ({
  listDirectoryProjects: listDirectoryProjectsMock,
}));

await mock.module("../settings/read.ts", () => ({
  readSettings: readSettingsMock,
}));

describe("tmuxinatorSource", () => {
  it("builds a tmuxinator source carrying the project's root", async () => {
    readTmuxinatorProjectMock.mockResolvedValue({ root: "/repos/orc" });

    expect(await tmuxinatorSource("orc")).toEqual({
      kind: "tmuxinator",
      name: "orc",
      repositoryRoot: "/repos/orc",
    });
  });
});

describe("listProjectSources", () => {
  describe("when tmuxinator projects exist", () => {
    it("returns a tmuxinator source for each project, sorted by name", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue(["orc", "notes"]);
      readTmuxinatorProjectMock.mockImplementation((name) =>
        Promise.resolve({ root: `/repos/${name}` }),
      );
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await listProjectSources()).toEqual([
        { kind: "tmuxinator", name: "notes", repositoryRoot: "/repos/notes" },
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
      ]);
    });
  });

  describe("when local repos are discovered", () => {
    it("merges the directory sources with the tmuxinator ones, sorted by name", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue(["orc"]);
      readTmuxinatorProjectMock.mockImplementation((name) =>
        Promise.resolve({ root: `/repos/${name}` }),
      );
      const directorySource: ProjectSource = {
        kind: "directory",
        name: "agents",
        repositoryRoot: "/repos/agents",
      };
      listDirectoryProjectsMock.mockResolvedValue([directorySource]);

      expect(await listProjectSources()).toEqual([
        directorySource,
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
      ]);
    });

    it("drops a directory source that shares a root with a tmuxinator project", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue(["orc-work"]);
      readTmuxinatorProjectMock.mockResolvedValue({ root: "/repos/orc" });
      listDirectoryProjectsMock.mockResolvedValue([
        { kind: "directory", name: "orc", repositoryRoot: "/repos/orc" },
      ]);

      expect(await listProjectSources()).toEqual([
        { kind: "tmuxinator", name: "orc-work", repositoryRoot: "/repos/orc" },
      ]);
    });

    it("discovers directory sources for the configured project paths", async () => {
      readSettingsMock.mockResolvedValue({ projectPaths: ["/repos/*"] });
      listTmuxinatorProjectsMock.mockResolvedValue(["orc"]);
      readTmuxinatorProjectMock.mockImplementation((name) =>
        Promise.resolve({ root: `/repos/${name}` }),
      );
      listDirectoryProjectsMock.mockResolvedValue([]);

      await listProjectSources();

      expect(listDirectoryProjectsMock).toHaveBeenCalledWith(
        ["/repos/*"],
        [{ kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" }],
      );
    });
  });

  describe("when no tmuxinator projects exist", () => {
    it("returns an empty array", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([]);
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await listProjectSources()).toEqual([]);
    });
  });
});
