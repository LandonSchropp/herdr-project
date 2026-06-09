import type { ProjectSource, TmuxinatorProject } from "../types.ts";
import { findProjectSource, listProjectSources } from "./project-sources.ts";
import { describe, expect, it, mock } from "bun:test";

const listTmuxinatorProjectsMock = mock<() => Promise<TmuxinatorProject[]>>(() =>
  Promise.resolve([]),
);
const listDirectoryProjectsMock = mock<
  (projectPaths: string[], sources: ProjectSource[]) => Promise<ProjectSource[]>
>(() => Promise.resolve([]));
const readSettingsMock = mock<() => Promise<{ projectPaths: string[] }>>(() =>
  Promise.resolve({ projectPaths: [] }),
);

await mock.module("../commands/tmuxinator.ts", () => ({
  listTmuxinatorProjects: listTmuxinatorProjectsMock,
}));

await mock.module("./directory-projects.ts", () => ({
  listDirectoryProjects: listDirectoryProjectsMock,
}));

await mock.module("../settings/read.ts", () => ({
  readSettings: readSettingsMock,
}));

describe("listProjectSources", () => {
  describe("when tmuxinator projects exist", () => {
    it("returns a tmuxinator source for each rooted project, sorted by name", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([
        { name: "orc", root: "/repos/orc" },
        { name: "notes", root: "/repos/notes" },
      ]);
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await listProjectSources()).toEqual([
        { kind: "tmuxinator", name: "notes", repositoryRoot: "/repos/notes" },
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
      ]);
    });
  });

  describe("when a tmuxinator project has no root", () => {
    it("omits it from the sources", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([
        { name: "orc", root: "/repos/orc" },
        { name: "scratch", root: null },
      ]);
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await listProjectSources()).toEqual([
        { kind: "tmuxinator", name: "orc", repositoryRoot: "/repos/orc" },
      ]);
    });
  });

  describe("when local repos are discovered", () => {
    it("merges the directory sources with the tmuxinator ones, sorted by name", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([{ name: "orc", root: "/repos/orc" }]);
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
      listTmuxinatorProjectsMock.mockResolvedValue([{ name: "orc-work", root: "/repos/orc" }]);
      listDirectoryProjectsMock.mockResolvedValue([
        { kind: "directory", name: "orc", repositoryRoot: "/repos/orc" },
      ]);

      expect(await listProjectSources()).toEqual([
        { kind: "tmuxinator", name: "orc-work", repositoryRoot: "/repos/orc" },
      ]);
    });

    it("discovers directory sources for the configured project paths", async () => {
      readSettingsMock.mockResolvedValue({ projectPaths: ["/repos/*"] });
      listTmuxinatorProjectsMock.mockResolvedValue([{ name: "orc", root: "/repos/orc" }]);
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

describe("findProjectSource", () => {
  describe("when a project source has the given name", () => {
    it("returns the matching source", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([{ name: "orc", root: "/repos/orc" }]);
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await findProjectSource("orc")).toEqual({
        kind: "tmuxinator",
        name: "orc",
        repositoryRoot: "/repos/orc",
      });
    });
  });

  describe("when no project source has the given name", () => {
    it("returns null", async () => {
      listTmuxinatorProjectsMock.mockResolvedValue([{ name: "orc", root: "/repos/orc" }]);
      listDirectoryProjectsMock.mockResolvedValue([]);

      expect(await findProjectSource("missing")).toBeNull();
    });
  });
});
