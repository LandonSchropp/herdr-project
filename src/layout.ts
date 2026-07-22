import { parseRootPaneId, runHerdr, runHerdrJson } from "./herdr.ts";
import type { Tab, WorkspaceLayout } from "./types.ts";

/**
 * Lays a project's tabs into a workspace Herdr has just created. The workspace already has one tab,
 * so the first tab reuses it and the rest are created alongside it. A tab with no command is left
 * as a plain shell. The tab named by `focusedTab` is focused when it opens; the first tab, which
 * reuses the workspace's existing tab, is focused when `focusedTab` matches it or matches no tab.
 *
 * @param workspace The workspace to lay the tabs into.
 * @param tabs The tabs to open, in display order.
 * @param focusedTab The label of the tab to focus, or `null` to leave the first tab focused.
 */
export async function applyLayout(
  workspace: WorkspaceLayout,
  tabs: Tab[],
  focusedTab: string | null,
): Promise<void> {
  const [first, ...rest] = tabs;

  if (first === undefined) return;

  await runHerdr(["tab", "rename", workspace.rootTabId, first.name]);

  if (first.command !== null) {
    await runHerdr(["pane", "run", workspace.rootPaneId, first.command]);
  }

  for (const tab of rest) {
    const response = await runHerdrJson([
      "tab",
      "create",
      "--workspace",
      workspace.workspaceId,
      "--cwd",
      workspace.repositoryRoot,
      "--label",
      tab.name,
      tab.name === focusedTab ? "--focus" : "--no-focus",
    ]);

    if (tab.command !== null) {
      await runHerdr(["pane", "run", parseRootPaneId(response), tab.command]);
    }
  }
}
