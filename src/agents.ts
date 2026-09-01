import { runHerdr, runHerdrJson } from "./herdr.ts";

/** How long to wait for a workspace's agent to be ready, in milliseconds. */
const READY_TIMEOUT_MILLISECONDS = 60_000;

/** How long to wait between checks while a workspace's agent is starting, in milliseconds. */
const POLL_INTERVAL_MILLISECONDS = 250;

/** How long Herdr is given to observe the agent start the prompt, in milliseconds. */
const PROMPT_TIMEOUT_MILLISECONDS = 10_000;

/**
 * Extracts the pane of the agent running in a workspace and ready for a prompt. An agent that is
 * still starting up counts as absent, since a prompt sent to it would be typed into a terminal that
 * isn't listening yet.
 *
 * @param response The parsed JSON response from an agent listing.
 * @param workspaceId The workspace whose agent to find.
 * @returns The agent's pane id, or `null` when the workspace has no agent ready.
 */
export function parseAgentPaneId(response: unknown, workspaceId: string): string | null {
  const agents = (response as { result?: { agents?: unknown } })?.result?.agents;

  if (!Array.isArray(agents)) return null;

  const match = agents.find((entry: unknown) => {
    const agent = entry as { workspace_id?: unknown; agent_status?: unknown };
    return agent.workspace_id === workspaceId && agent.agent_status === "idle";
  }) as { pane_id?: unknown } | undefined;

  return typeof match?.pane_id === "string" ? match.pane_id : null;
}

/**
 * Waits for a workspace's agent to start and become ready for a prompt. A workspace's tabs are laid
 * out asynchronously by the `workspace.created` hook, so its agent doesn't exist yet when the
 * workspace opens.
 *
 * @param workspaceId The workspace whose agent to wait for.
 * @param timeout How long to wait before giving up, in milliseconds.
 * @returns The agent's pane id.
 * @throws When no agent is ready before the timeout elapses.
 */
export async function waitForWorkspaceAgent(
  workspaceId: string,
  timeout: number = READY_TIMEOUT_MILLISECONDS,
): Promise<string> {
  const deadline = Date.now() + timeout;

  for (;;) {
    const paneId = parseAgentPaneId(await runHerdrJson(["agent", "list"]), workspaceId);

    if (paneId !== null) return paneId;

    if (Date.now() >= deadline) throw new Error(`no agent is running in ${workspaceId}.`);

    await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
  }
}

/**
 * Sends a prompt to the agent running in a workspace, waiting for the agent to start first. Returns
 * once the agent has begun working on the prompt rather than when it answers, so a prompt Herdr
 * never delivered is reported instead of passing silently.
 *
 * @param workspaceId The workspace whose agent to prompt.
 * @param prompt The prompt to send.
 * @throws When no agent starts, or the agent does not start the prompt.
 */
export async function promptWorkspaceAgent(workspaceId: string, prompt: string): Promise<void> {
  const paneId = await waitForWorkspaceAgent(workspaceId);

  await runHerdr([
    "agent",
    "prompt",
    paneId,
    prompt,
    "--wait",
    "--until",
    "working",
    "--timeout",
    `${PROMPT_TIMEOUT_MILLISECONDS}`,
  ]);
}
