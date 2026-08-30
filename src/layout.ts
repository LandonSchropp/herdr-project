import { parseRootPaneId, runHerdr, runHerdrJson } from "./herdr.ts";
import type { Tab, WorkspaceLayout } from "./types.ts";

/**
 * Lays a project's tabs into a workspace Herdr has just created. The workspace already has one tab,
 * so the first tab reuses it and the rest are created alongside it. A tab with no command is left
 * as a plain shell. The tab named by `focusedTab` is focused when it opens; the first tab, which
 * reuses the workspace's existing tab, is focused when `focusedTab` matches it or matches no tab.
 *
 * Focusing a tab pulls the whole session to its workspace, so `focus` must be false for a workspace
 * the session isn't already showing. Such a workspace opens on its first tab and `focusedTab` is
 * ignored, which is the price of not yanking the user out of the workspace they are in.
 *
 * @param workspace The workspace to lay the tabs into.
 * @param tabs The tabs to open, in display order.
 * @param focusedTab The label of the tab to focus, or `null` to leave the first tab focused.
 * @param focus Whether any tab may be focused at all.
 */
export async function applyLayout(
  workspace: WorkspaceLayout,
  tabs: Tab[],
  focusedTab: string | null,
  focus: boolean = true,
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
      workspace.checkoutPath,
      "--label",
      tab.name,
      focus && tab.name === focusedTab ? "--focus" : "--no-focus",
    ]);

    if (tab.command !== null) {
      await runHerdr(["pane", "run", parseRootPaneId(response), tab.command]);
    }
  }
}
