/** The agent status when Claude is actively executing. */
export const WORKING_AGENT_STATUS = "Working";

/** The agent status when Claude is paused awaiting user input or approval. */
export const WAITING_AGENT_STATUS = "Waiting";

/** The agent status when Claude has finished a turn and is sitting at the prompt. */
export const IDLE_AGENT_STATUS = "Idle";

/** All valid agent statuses. Source of truth for both the type and runtime validation. */
export const AGENT_STATUSES = [
  WORKING_AGENT_STATUS,
  WAITING_AGENT_STATUS,
  IDLE_AGENT_STATUS,
] as const;

/** The session status when a live tmux session backs it. */
export const RUNNING_SESSION_STATUS = "running";

/** The session status when no live tmux session backs it. */
export const STOPPED_SESSION_STATUS = "stopped";

/** The session status when its worktree has been removed. */
export const DELETED_SESSION_STATUS = "deleted";

/** All valid session statuses. Source of truth for the type. */
export const SESSION_STATUSES = [
  RUNNING_SESSION_STATUS,
  STOPPED_SESSION_STATUS,
  DELETED_SESSION_STATUS,
] as const;

/** All valid project kinds. Source of truth for both the type and runtime validation. */
export const PROJECT_KINDS = ["tmuxinator", "directory"] as const;

/** Claude Code hook event fired when the user submits a prompt. */
export const USER_PROMPT_SUBMIT_HOOK_EVENT = "UserPromptSubmit";

/** Claude Code hook event fired when Claude finishes a turn. */
export const STOP_HOOK_EVENT = "Stop";

/** Claude Code hook event fired for notifications such as permission prompts. */
export const NOTIFICATION_HOOK_EVENT = "Notification";

/** Claude Code hook event fired after a tool finishes running. */
export const POST_TOOL_USE_HOOK_EVENT = "PostToolUse";

/** Claude Code hook events orc subscribes to. */
export const HOOK_EVENTS = [
  USER_PROMPT_SUBMIT_HOOK_EVENT,
  STOP_HOOK_EVENT,
  NOTIFICATION_HOOK_EVENT,
  POST_TOOL_USE_HOOK_EVENT,
] as const;

/**
 * The built-in tmuxinator scaffold project. It is not a real orc project — it is filtered out of
 * the project list — but its config serves as the template for directory projects, which have no
 * tmuxinator config of their own.
 */
export const DEFAULT_PROJECT = "default";
