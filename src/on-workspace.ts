import { runHerdrJson } from "./herdr.ts";
import { applyLayout } from "./layout.ts";
import { takePendingPrompt } from "./pending-prompt.ts";
import { listProjects } from "./projects.ts";

/** What a newly created workspace looks like, as far as laying a project's tabs into it goes. */
export type WorkspaceDetails = {
  /** The main repository the workspace's worktree belongs to, or `null` when it has no worktree. */
  repositoryRoot: string | null;
  /** How many panes the workspace already has. */
  paneCount: number;
  /** The workspace's active tab, which for a fresh workspace is its only tab. */
  activeTabId: string | null;
  /** The absolute path to the worktree's checkout, or `null` when it has no worktree. */
  checkoutPath: string | null;
};

/**
 * Reads the workspace id a `workspace.created` event refers to. Herdr passes it both as an
 * environment variable and inside the event payload, so the variable is preferred and the payload
 * is the fallback.
 *
 * @param eventJson The raw `HERDR_PLUGIN_EVENT_JSON` value.
 * @param workspaceId The raw `HERDR_WORKSPACE_ID` value.
 * @returns The workspace id, or `null` when neither source carries one.
 */
export function parseEventWorkspaceId(
  eventJson: string | undefined,
  workspaceId: string | undefined,
): string | null {
  if (typeof workspaceId === "string" && workspaceId !== "") return workspaceId;
  if (eventJson === undefined || eventJson.trim() === "") return null;

  try {
    const parsed: unknown = JSON.parse(eventJson);
    const id = (parsed as { data?: { workspace_id?: unknown } })?.data?.workspace_id;
    return typeof id === "string" && id !== "" ? id : null;
  } catch {
    return null;
  }
}

/**
 * Extracts what a `workspace get` response says about a workspace.
 *
 * @param response The parsed JSON response.
 * @returns The workspace's repository, pane count, active tab, and checkout path.
 */
export function parseWorkspaceDetails(response: unknown): WorkspaceDetails {
  const workspace = (
    response as
      | {
          result?: {
            workspace?: {
              worktree?: { repo_root?: unknown; checkout_path?: unknown };
              pane_count?: unknown;
              active_tab_id?: unknown;
            };
          };
        }
      | undefined
  )?.result?.workspace;

  const repositoryRoot = workspace?.worktree?.repo_root;
  const paneCount = workspace?.pane_count;
  const activeTabId = workspace?.active_tab_id;
  const checkoutPath = workspace?.worktree?.checkout_path;

  return {
    repositoryRoot: typeof repositoryRoot === "string" ? repositoryRoot : null,
    paneCount: typeof paneCount === "number" ? paneCount : 0,
    activeTabId: typeof activeTabId === "string" ? activeTabId : null,
    checkoutPath: typeof checkoutPath === "string" ? checkoutPath : null,
  };
}

/**
 * Finds the pane belonging to a tab in a `pane list` response.
 *
 * @param response The parsed JSON response.
 * @param tabId The tab whose pane to find.
 * @returns The pane's id, or `null` when the tab has none.
 */
export function parseTabPaneId(response: unknown, tabId: string): string | null {
  const panes = (response as { result?: { panes?: unknown } } | undefined)?.result?.panes;

  if (!Array.isArray(panes)) return null;

  const pane = panes.find((entry: unknown) => (entry as { tab_id?: unknown })?.tab_id === tabId) as
    { pane_id?: unknown } | undefined;

  return typeof pane?.pane_id === "string" ? pane.pane_id : null;
}

/**
 * Lays the matching project's tabs into a workspace Herdr has just created. This runs for every new
 * workspace, so it is a quiet no-op whenever the workspace isn't one we lay out: it has no
 * worktree, its repository isn't a configured project, or it already has more than the one pane a
 * fresh workspace starts with.
 *
 * @param workspaceId The workspace to lay out.
 * @returns A message describing what was done, for the plugin log.
 */
export async function applyProjectLayout(workspaceId: string): Promise<string> {
  const details = parseWorkspaceDetails(await runHerdrJson(["workspace", "get", workspaceId]));

  if (details.repositoryRoot === null) {
    return `workspace ${workspaceId} has no worktree; nothing to do.`;
  }

  if (details.paneCount > 1) {
    return `workspace ${workspaceId} already has ${details.paneCount} panes; skipping layout.`;
  }

  const project = (await listProjects()).find(
    (entry) => entry.repositoryRoot === details.repositoryRoot,
  );

  if (project === undefined) {
    return `no project matches ${details.repositoryRoot}; nothing to do.`;
  }

  if (details.activeTabId === null) {
    return `workspace ${workspaceId} reported no tab; nothing to do.`;
  }

  const paneId = parseTabPaneId(
    await runHerdrJson(["pane", "list", "--workspace", workspaceId]),
    details.activeTabId,
  );

  if (paneId === null) {
    return `tab ${details.activeTabId} reported no pane; nothing to do.`;
  }

  const prompt =
    details.checkoutPath === null ? null : await takePendingPrompt(details.checkoutPath);

  await applyLayout(
    {
      workspaceId,
      rootTabId: details.activeTabId,
      rootPaneId: paneId,
      repositoryRoot: details.repositoryRoot,
    },
    project.tabs,
    project.focusedTab,
    prompt,
  );

  return `applied ${project.name} layout to ${workspaceId}: ${project.tabs.length} tab(s).`;
}
