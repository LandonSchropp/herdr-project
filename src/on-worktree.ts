import { mainCheckoutPath } from "./git.ts";
import { copyIncludedPaths } from "./worktree-include.ts";

/**
 * Reads the checkout path a `worktree.created` event refers to. Herdr carries the worktree only in
 * the event payload, so unlike a workspace id there is no environment variable to prefer.
 *
 * @param eventJson The raw `HERDR_PLUGIN_EVENT_JSON` value.
 * @returns The worktree's path, or `null` when the payload carries none.
 */
export function parseEventWorktreePath(eventJson: string | undefined): string | null {
  if (eventJson === undefined || eventJson.trim() === "") return null;

  try {
    const parsed: unknown = JSON.parse(eventJson);
    const path = (parsed as { data?: { worktree?: { path?: unknown } } })?.data?.worktree?.path;

    return typeof path === "string" && path !== "" ? path : null;
  } catch {
    return null;
  }
}

/**
 * Copies the untracked files a repository's include files match into a worktree Herdr has just
 * created, which is how environment files and the like reach a fresh checkout. This runs for every
 * new worktree, so it is a quiet no-op whenever there is nothing to copy: the path is not in a
 * repository, it is the main checkout the files would come from, or no pattern matches.
 *
 * @param worktree The absolute path to the worktree to copy into.
 * @returns A message describing what was done, for the plugin log.
 */
export async function copyWorktreeIncludes(worktree: string): Promise<string> {
  const mainCheckout = await mainCheckoutPath(worktree);

  if (mainCheckout === null) return `${worktree} is in no repository; nothing to do.`;

  if (mainCheckout === worktree) {
    return `${worktree} is the repository's main checkout; nothing to do.`;
  }

  const copied = await copyIncludedPaths(mainCheckout, worktree);

  if (copied.length === 0) return `nothing to copy into ${worktree}.`;

  return `copied ${copied.length} path(s) into ${worktree}: ${copied.join(", ")}.`;
}
