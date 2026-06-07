import { agentFactory } from "../../test/factories/agent.ts";
import { sessionFactory } from "../../test/factories/session.ts";
import { stdoutSpy } from "../../test/helpers/process.ts";
import type { Session } from "../types.ts";
import { formatSession, formatSessionTable, formatSessionTsv, listCommand } from "./list.ts";
import { describe, expect, it, mock } from "bun:test";
import { runCommand } from "citty";

const listSessionsMock = mock((): Promise<Session[]> => Promise.resolve([]));

await mock.module("../sessions/list.ts", () => ({
  listSessions: listSessionsMock,
}));

describe("formatSession", () => {
  it("returns the cell values with the first agent's lowercased status", () => {
    const session = sessionFactory.build({
      project: "orc",
      session: "feature-a",
      worktree: "linked",
      status: "running",
      agents: [agentFactory.build({ status: "Working" })],
    });

    expect(formatSession(session)).toEqual(["orc", "feature-a", "linked", "running", "working"]);
  });

  describe("when the session has no agents", () => {
    it("uses n/a for the agent", () => {
      const session = sessionFactory.build({ agents: [] });

      expect(formatSession(session).at(-1)).toBe("n/a");
    });
  });
});

describe("formatSessionTable", () => {
  it("renders a borderless table with a bold blue header", () => {
    const session = sessionFactory.build({ project: "orc", session: "feature-a" });

    const output = formatSessionTable([session]);

    const escape = String.fromCharCode(27);
    expect(output).toContain(`${escape}[1;34mPROJECT${escape}[0m`);
    expect(output).toContain("feature-a");
  });

  describe("when there are no sessions", () => {
    it("still renders the header", () => {
      expect(formatSessionTable([])).toContain("PROJECT");
    });
  });
});

describe("formatSessionTsv", () => {
  it("renders one tab-separated row per session with no header", () => {
    const sessions = [
      sessionFactory.build({
        project: "orc",
        session: "feature-a",
        worktree: "linked",
        status: "running",
        agents: [agentFactory.build({ status: "Working" })],
      }),
      sessionFactory.build({
        project: "orc",
        session: "main",
        worktree: "main",
        status: "stopped",
        agents: [],
      }),
    ];

    expect(formatSessionTsv(sessions)).toBe(
      ["orc\tfeature-a\tlinked\trunning\tworking", "orc\tmain\tmain\tstopped\tn/a"].join("\n"),
    );
  });

  describe("when there are no sessions", () => {
    it("returns an empty string", () => {
      expect(formatSessionTsv([])).toBe("");
    });
  });
});

describe("listCommand", () => {
  describe("when there are sessions", () => {
    it("writes the list", async () => {
      listSessionsMock.mockResolvedValue([
        sessionFactory.build({
          project: "orc",
          session: "feature-a",
          worktree: "main",
          status: "running",
        }),
      ]);

      await runCommand(listCommand, { rawArgs: [] });

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("feature-a"));
    });
  });
});
