import { parseRootPaneId, runHerdr, runHerdrJson } from "./herdr.ts";
import type { Tab, Workspace } from "./types.ts";

/**
 * Lays a project's tabs into a workspace Herdr has just created. The workspace already has one tab,
 * so the first tab reuses it and the rest are created alongside it. A tab with no command is left
 * as a plain shell.
 *
 * @param workspace The workspace to lay the tabs into.
 * @param tabs The tabs to open, in display order.
 */
export async function applyLayout(workspace: Workspace, tabs: Tab[]): Promise<void> {
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
      "--label",
      tab.name,
      "--no-focus",
    ]);

    if (tab.command !== null) {
      await runHerdr(["pane", "run", parseRootPaneId(response), tab.command]);
    }
  }
}
