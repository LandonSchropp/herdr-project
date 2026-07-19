import type { Workspace } from "./types.ts";

/**
 * Runs a `herdr` CLI command and returns its raw output. Not every command prints something — `pane
 * run`, for one, prints nothing — so callers that need a response use {@link runHerdrJson}.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @returns Whatever the command wrote to stdout.
 * @throws When the command exits non-zero.
 */
export async function runHerdr(args: string[]): Promise<string> {
  const process = Bun.spawn(["herdr", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`herdr ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }

  return stdout;
}

/**
 * Runs a `herdr` CLI command that prints JSON and returns the parsed response.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @returns The parsed JSON response.
 * @throws When the command exits non-zero or prints output that is not JSON.
 */
export async function runHerdrJson(args: string[]): Promise<unknown> {
  const stdout = await runHerdr(args);

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`herdr ${args.join(" ")} did not print JSON: ${stdout.trim()}`);
  }
}

/**
 * Extracts the id of the pane Herdr reports after creating a workspace or tab.
 *
 * @param response The parsed JSON response.
 * @returns The pane's id.
 * @throws When the response does not describe a pane.
 */
export function parseRootPaneId(response: unknown): string {
  const paneId = (response as { result?: { root_pane?: { pane_id?: unknown } } } | undefined)
    ?.result?.root_pane?.pane_id;

  if (typeof paneId !== "string") throw new Error("herdr did not report a pane");

  return paneId;
}

/**
 * Extracts the workspace, tab, and pane Herdr reports after creating or opening a workspace.
 *
 * @param response The parsed JSON response.
 * @returns The workspace described by the response.
 * @throws When the response does not describe a workspace.
 */
export function parseWorkspace(response: unknown): Workspace {
  const result = (
    response as
      | { result?: { workspace?: { workspace_id?: unknown }; tab?: { tab_id?: unknown } } }
      | undefined
  )?.result;

  const workspaceId = result?.workspace?.workspace_id;
  const rootTabId = result?.tab?.tab_id;

  if (typeof workspaceId !== "string" || typeof rootTabId !== "string") {
    throw new Error("herdr did not report a workspace");
  }

  return { workspaceId, rootTabId, rootPaneId: parseRootPaneId(response) };
}
