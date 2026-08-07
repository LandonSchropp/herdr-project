import { parseRootPaneId, runHerdr, runHerdrJson } from "./herdr.ts";
import type { Tab, WorkspaceLayout } from "./types.ts";

/** The environment variable the prompt tab's command sees the prompt in. */
const AGENT_PROMPT_ENV_VAR = "AGENT_PROMPT";

/**
 * Quotes a value for safe interpolation into a single POSIX shell word.
 *
 * @param value The value to quote.
 * @returns The value wrapped in single quotes, with embedded single quotes escaped.
 */
function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

/**
 * Lays a project's tabs into a workspace Herdr has just created. The workspace already has one tab,
 * so the first tab reuses it and the rest are created alongside it. A tab with no command is left
 * as a plain shell. The tab named by `focusedTab` is focused when it opens; the first tab, which
 * reuses the workspace's existing tab, is focused when `focusedTab` matches it or matches no tab.
 *
 * When `prompt` is given, it is handed to the tab named by `focusedTab` through the `AGENT_PROMPT`
 * environment variable — prefixed onto the command for the first tab, since Herdr has no way to set
 * env on the pane it creates with the workspace, and passed as `--env` when the tab is created for
 * any other tab.
 *
 * @param workspace The workspace to lay the tabs into.
 * @param tabs The tabs to open, in display order.
 * @param focusedTab The label of the tab to focus, or `null` to leave the first tab focused.
 * @param prompt The prompt to hand to the tab named by `focusedTab`, or `null` to prompt nothing.
 */
export async function applyLayout(
  workspace: WorkspaceLayout,
  tabs: Tab[],
  focusedTab: string | null,
  prompt: string | null,
): Promise<void> {
  const [first, ...rest] = tabs;

  if (first === undefined) return;

  await runHerdr(["tab", "rename", workspace.rootTabId, first.name]);

  if (first.name === focusedTab && prompt !== null) {
    const command =
      first.command === null
        ? `export ${AGENT_PROMPT_ENV_VAR}=${shellQuote(prompt)}`
        : `${AGENT_PROMPT_ENV_VAR}=${shellQuote(prompt)} ${first.command}`;

    await runHerdr(["pane", "run", workspace.rootPaneId, command]);
  } else if (first.command !== null) {
    await runHerdr(["pane", "run", workspace.rootPaneId, first.command]);
  }

  for (const tab of rest) {
    const isPromptTab = tab.name === focusedTab && prompt !== null;

    const response = await runHerdrJson([
      "tab",
      "create",
      "--workspace",
      workspace.workspaceId,
      "--cwd",
      workspace.repositoryRoot,
      "--label",
      tab.name,
      ...(isPromptTab ? ["--env", `${AGENT_PROMPT_ENV_VAR}=${prompt}`] : []),
      tab.name === focusedTab ? "--focus" : "--no-focus",
    ]);

    if (tab.command !== null) {
      await runHerdr(["pane", "run", parseRootPaneId(response), tab.command]);
    }
  }
}
