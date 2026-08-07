import { expandHome } from "./settings.ts";
import { mkdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The directory pending prompts are stored under. Override with
 * `HERDR_PROJECT_PENDING_PROMPTS_DIR`.
 *
 * @returns The absolute path to the directory.
 */
export function pendingPromptsDirectory(): string {
  const override = process.env.HERDR_PROJECT_PENDING_PROMPTS_DIR;
  return override ? expandHome(override) : join(homedir(), ".cache/herdr-project/pending-prompts");
}

/**
 * The file a checkout path's pending prompt is stored in.
 *
 * @param checkoutPath The absolute path to the worktree's checkout.
 * @returns The absolute path to the prompt file.
 */
function pendingPromptPath(checkoutPath: string): string {
  return join(pendingPromptsDirectory(), `${encodeURIComponent(checkoutPath)}.txt`);
}

/**
 * Records a prompt for a checkout path, for {@link takePendingPrompt} to pick up once the workspace
 * it opens into is laid out.
 *
 * @param checkoutPath The absolute path to the worktree's checkout.
 * @param prompt The prompt to record.
 */
export async function writePendingPrompt(checkoutPath: string, prompt: string): Promise<void> {
  const path = pendingPromptPath(checkoutPath);
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, prompt);
}

/**
 * Reads and clears the pending prompt recorded for a checkout path, so a workspace's tabs are laid
 * out with it at most once.
 *
 * @param checkoutPath The absolute path to the worktree's checkout.
 * @returns The recorded prompt, or `null` when none is pending.
 */
export async function takePendingPrompt(checkoutPath: string): Promise<string | null> {
  const path = pendingPromptPath(checkoutPath);
  const file = Bun.file(path);

  if (!(await file.exists())) return null;

  const prompt = await file.text();
  await unlink(path);

  return prompt;
}
