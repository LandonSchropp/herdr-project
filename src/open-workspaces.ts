import { mainCheckoutPath } from "./git.ts";
import { runHerdrJson } from "./herdr.ts";
import type { OpenWorkspace, ReportedWorkspace } from "./types.ts";

/**
 * Extracts what Herdr reports about each open workspace: its label, the worktree it manages for the
 * workspace, if any, and the directory the workspace's first pane is in, which is the only thing
 * left to go on when it manages none. A workspace Herdr reports without an id contributes nothing.
 *
 * @param workspaceResponse The parsed JSON response from a workspace listing.
 * @param paneResponse The parsed JSON response from a pane listing.
 * @returns What was reported about each workspace, in the order the workspaces were listed.
 */
export function parseReportedWorkspaces(
  workspaceResponse: unknown,
  paneResponse: unknown,
): ReportedWorkspace[] {
  const workspaces = (workspaceResponse as { result?: { workspaces?: unknown } })?.result
    ?.workspaces;

  if (!Array.isArray(workspaces)) return [];

  const panes = (paneResponse as { result?: { panes?: unknown } })?.result?.panes;
  const directories = new Map<string, string>();

  for (const entry of Array.isArray(panes) ? panes : []) {
    const pane = entry as { workspace_id?: unknown; cwd?: unknown };

    if (typeof pane.workspace_id !== "string" || typeof pane.cwd !== "string") continue;
    if (!directories.has(pane.workspace_id)) directories.set(pane.workspace_id, pane.cwd);
  }

  return workspaces.flatMap((entry: unknown) => {
    const workspace = entry as {
      workspace_id?: unknown;
      label?: unknown;
      worktree?: { checkout_path?: unknown; repo_root?: unknown };
    };

    if (typeof workspace.workspace_id !== "string") return [];

    const checkoutPath = workspace.worktree?.checkout_path;
    const repositoryRoot = workspace.worktree?.repo_root;

    return [
      {
        workspaceId: workspace.workspace_id,
        label: typeof workspace.label === "string" ? workspace.label : null,
        worktree:
          typeof checkoutPath === "string" && typeof repositoryRoot === "string"
            ? { checkoutPath, repositoryRoot }
            : null,
        paneDirectory: directories.get(workspace.workspace_id) ?? null,
      },
    ];
  });
}

/**
 * Lists the open workspaces that are showing a checkout, and the repository each one belongs to.
 *
 * A workspace Herdr opened as one of its own worktrees carries that identity, and a flat workspace
 * does not, so the repository behind a flat one is resolved from its first pane's directory
 * instead. A workspace whose directory is in no repository is its own root. A workspace that
 * reports no pane at all is left out.
 *
 * @returns The open workspaces, in the order Herdr listed them.
 */
export async function listOpenWorkspaces(): Promise<OpenWorkspace[]> {
  const [workspaceResponse, paneResponse] = await Promise.all([
    runHerdrJson(["workspace", "list"]),
    runHerdrJson(["pane", "list"]),
  ]);

  const resolved = await Promise.all(
    parseReportedWorkspaces(workspaceResponse, paneResponse).map(
      async ({ workspaceId, label, worktree, paneDirectory }): Promise<OpenWorkspace | null> => {
        if (worktree !== null) return { workspaceId, label, ...worktree, isManagedWorktree: true };
        if (paneDirectory === null) return null;

        return {
          workspaceId,
          label,
          checkoutPath: paneDirectory,
          repositoryRoot: (await mainCheckoutPath(paneDirectory)) ?? paneDirectory,
          isManagedWorktree: false,
        };
      },
    ),
  );

  return resolved.filter((workspace) => workspace !== null);
}

/**
 * Finds the workspace open for a checkout path.
 *
 * @param path The absolute path to the checkout.
 * @returns The workspace, or `null` when none is open for it.
 */
export async function findOpenWorkspace(path: string): Promise<OpenWorkspace | null> {
  return (await listOpenWorkspaces()).find((workspace) => workspace.checkoutPath === path) ?? null;
}
