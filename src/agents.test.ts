import { stubModule } from "../test/helpers/module.ts";
import { parseAgentPaneId, promptWorkspaceAgent, waitForWorkspaceAgent } from "./agents.ts";
import { HerdrTimeoutError } from "./herdr.ts";
import { describe, expect, it, mock } from "bun:test";

/**
 * Builds an `agent list` response containing a single agent.
 *
 * @param workspaceId The workspace the agent is running in.
 * @param status The agent's status.
 * @returns The response, shaped the way `herdr agent list` prints it.
 */
function agentList(workspaceId: string, status: string) {
  return {
    result: { agents: [{ workspace_id: workspaceId, agent_status: status, pane_id: "wG:p3" }] },
  };
}

/**
 * Replaces the herdr module so the agent helpers can be exercised without a running Herdr session.
 *
 * @param responses The responses `runHerdrJson` returns, one per call, repeating the last one. An
 *   `Error` is thrown rather than returned, which is how an unanswered or refused check is staged.
 * @returns The mocks standing in for each replaced function.
 */
async function mockHerdrModule(responses: unknown[]) {
  const mocks = {
    HerdrTimeoutError,
    runHerdr: mock(() => Promise.resolve("")),
    runHerdrJson: mock(() => {
      const response = responses.length > 1 ? responses.shift() : responses[0];

      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    }),
  };

  await stubModule(import.meta.resolve("./herdr.ts"), () => mocks);

  return mocks;
}

describe("parseAgentPaneId", () => {
  it("returns the pane of the workspace's idle agent", () => {
    expect(parseAgentPaneId(agentList("wG", "idle"), "wG")).toBe("wG:p3");
  });

  describe("when the agent settled without its tab being seen", () => {
    it("returns the agent's pane", () => {
      expect(parseAgentPaneId(agentList("wG", "done"), "wG")).toBe("wG:p3");
    });
  });

  describe("when the agent belongs to another workspace", () => {
    it("returns null", () => {
      expect(parseAgentPaneId(agentList("wH", "idle"), "wG")).toBeNull();
    });
  });

  describe("when the agent is still starting", () => {
    it("returns null", () => {
      expect(parseAgentPaneId(agentList("wG", "unknown"), "wG")).toBeNull();
    });
  });

  describe("when the response describes no agents", () => {
    it("returns null", () => {
      expect(parseAgentPaneId({}, "wG")).toBeNull();
    });
  });
});

describe("waitForWorkspaceAgent", () => {
  it("returns the pane of the workspace's agent", async () => {
    await mockHerdrModule([agentList("wG", "idle")]);

    expect(await waitForWorkspaceAgent("wG")).toBe("wG:p3");
  });

  describe("when the agent is still starting", () => {
    it("waits for it to become idle", async () => {
      await mockHerdrModule([agentList("wG", "unknown"), agentList("wG", "idle")]);

      expect(await waitForWorkspaceAgent("wG")).toBe("wG:p3");
    });
  });

  describe("when no agent becomes ready before the timeout", () => {
    it("throws", async () => {
      await mockHerdrModule([agentList("wG", "unknown")]);

      const thrown = await waitForWorkspaceAgent("wG", 0).catch((error: Error) => error);

      expect((thrown as Error).message).toContain("no agent is running in wG");
    });
  });

  it("bounds each check", async () => {
    const mocks = await mockHerdrModule([agentList("wG", "idle")]);

    await waitForWorkspaceAgent("wG");

    expect(mocks.runHerdrJson).toHaveBeenCalledWith(["agent", "list"], expect.any(Number));
  });

  describe("when a check goes unanswered", () => {
    it("checks again", async () => {
      await mockHerdrModule([new HerdrTimeoutError("timed out"), agentList("wG", "idle")]);

      expect(await waitForWorkspaceAgent("wG")).toBe("wG:p3");
    });
  });

  describe("when every check goes unanswered", () => {
    it("throws without claiming no agent is running", async () => {
      await mockHerdrModule([new HerdrTimeoutError("timed out")]);

      const thrown = await waitForWorkspaceAgent("wG", 0).catch((error: Error) => error);

      expect((thrown as Error).message).toContain("wG");
      expect((thrown as Error).message).not.toContain("no agent is running");
    });
  });

  describe("when Herdr reports an error", () => {
    it("raises it rather than waiting out the timeout", async () => {
      await mockHerdrModule([new Error("herdr agent list failed: no session")]);

      const thrown = await waitForWorkspaceAgent("wG").catch((error: Error) => error);

      expect((thrown as Error).message).toContain("no session");
    });
  });
});

describe("promptWorkspaceAgent", () => {
  it("prompts the workspace's agent", async () => {
    const mocks = await mockHerdrModule([agentList("wG", "idle")]);

    await promptWorkspaceAgent("wG", "read the README");

    expect(mocks.runHerdr).toHaveBeenCalledWith(
      [
        "agent",
        "prompt",
        "wG:p3",
        "read the README",
        "--wait",
        "--until",
        "working",
        "--timeout",
        "10000",
      ],
      expect.any(Number),
    );
  });
});
