import { stubModule } from "../test/helpers/module.ts";
import { parseAgentPaneId, promptWorkspaceAgent, waitForWorkspaceAgent } from "./agents.ts";
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
 * @param responses The responses `runHerdrJson` returns, one per call, repeating the last one.
 * @returns The mocks standing in for each replaced function.
 */
async function mockHerdrModule(responses: unknown[]) {
  const mocks = {
    runHerdr: mock(() => Promise.resolve("")),
    runHerdrJson: mock(() =>
      Promise.resolve(responses.length > 1 ? responses.shift() : responses[0]),
    ),
  };

  await stubModule(import.meta.resolve("./herdr.ts"), () => mocks);

  return mocks;
}

describe("parseAgentPaneId", () => {
  it("returns the pane of the workspace's idle agent", () => {
    expect(parseAgentPaneId(agentList("wG", "idle"), "wG")).toBe("wG:p3");
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
});

describe("promptWorkspaceAgent", () => {
  it("prompts the workspace's agent", async () => {
    const mocks = await mockHerdrModule([agentList("wG", "idle")]);

    await promptWorkspaceAgent("wG", "read the README");

    expect(mocks.runHerdr).toHaveBeenCalledWith([
      "agent",
      "prompt",
      "wG:p3",
      "read the README",
      "--wait",
      "--until",
      "working",
      "--timeout",
      "10000",
    ]);
  });
});
