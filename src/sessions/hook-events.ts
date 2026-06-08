import { sessionId } from "../commands/tmux.ts";
import {
  IDLE_AGENT_STATUS,
  NOTIFICATION_HOOK_EVENT,
  POST_TOOL_USE_HOOK_EVENT,
  STOP_HOOK_EVENT,
  USER_PROMPT_SUBMIT_HOOK_EVENT,
  WAITING_AGENT_STATUS,
  WORKING_AGENT_STATUS,
} from "../constants.ts";
import { type AgentStatus, type HookPayload } from "../types.ts";
import { parseSessionId } from "./id.ts";
import { readStateFile, writeStateFile } from "./state.ts";

/**
 * Notification types Claude Code uses when it actually needs the user — a tool permission prompt or
 * an MCP elicitation dialog. The remaining documented types (`auth_success`,
 * `elicitation_complete`, `elicitation_response`) are informational and must not flip the agent
 * into Waiting.
 */
const USER_INPUT_NOTIFICATION_TYPES = new Set(["permission_prompt", "elicitation_dialog"]);

/**
 * The Notification type Claude Code fires when it is sitting idle at the prompt. It is the only
 * signal orc receives after the user cancels a turn — Claude Code fires no Stop hook on user
 * interrupts — so it is what unsticks a pane left in Waiting or Working by a cancellation.
 */
const IDLE_NOTIFICATION_TYPE = "idle_prompt";

/**
 * Reports whether a Notification's `notification_type` indicates Claude is blocked on the user.
 *
 * @param notificationType The payload's `notification_type` field.
 * @returns `true` when the notification type means the agent is waiting on user input.
 */
function isUserInputNotification(notificationType: string): boolean {
  return USER_INPUT_NOTIFICATION_TYPES.has(notificationType);
}

/**
 * Maps a Notification's `notification_type` to the agent status it represents.
 *
 * @param notificationType The payload's `notification_type` field.
 * @returns Waiting when Claude needs the user, Idle when Claude is idle at the prompt, or `null`
 *   for informational notifications that should not change the status.
 */
function notificationToStatus(notificationType: string): AgentStatus | null {
  if (isUserInputNotification(notificationType)) return WAITING_AGENT_STATUS;
  if (notificationType === IDLE_NOTIFICATION_TYPE) return IDLE_AGENT_STATUS;
  return null;
}

/**
 * Maps a Claude Code hook payload to the agent status it represents. Returns `null` for
 * informational Notification payloads (e.g. `auth_success`) that should not change the status.
 *
 * @param payload The hook payload from Claude Code.
 * @returns The corresponding agent status, or `null` if the payload should not change the status.
 */
function payloadToStatus(payload: HookPayload): AgentStatus | null {
  switch (payload.hook_event_name) {
    case USER_PROMPT_SUBMIT_HOOK_EVENT:
    case POST_TOOL_USE_HOOK_EVENT:
      return WORKING_AGENT_STATUS;
    case STOP_HOOK_EVENT:
      return IDLE_AGENT_STATUS;
    case NOTIFICATION_HOOK_EVENT:
      return notificationToStatus(payload.notification_type);
  }
}

/**
 * Processes a Claude Code hook payload for the given firing pane, recording the corresponding agent
 * status for its session. Silently skips payloads that do not map to a status change, including
 * informational Notifications (like the idle reminder) that the Stop event already covers as Idle.
 *
 * When the status is unchanged the recorded timestamp is preserved, so it keeps marking when the
 * agent entered that status rather than when the latest event fired.
 *
 * @param payload The validated hook payload from Claude Code.
 * @param paneId The tmux pane id where the hook fired.
 */
export async function processHookEvent(payload: HookPayload, paneId: string): Promise<void> {
  const status = payloadToStatus(payload);
  if (!status) return;

  const id = parseSessionId(await sessionId(paneId));
  if (!id) return;

  const current = await readStateFile(id[0], id[1], paneId);
  if (current?.status === status) return;

  await writeStateFile(id[0], id[1], paneId, status);
}
