import {
  AGENT_STATUSES,
  NOTIFICATION_HOOK_EVENT,
  POST_TOOL_USE_HOOK_EVENT,
  PROJECT_KINDS,
  SESSION_STATUSES,
  STOP_HOOK_EVENT,
  USER_PROMPT_SUBMIT_HOOK_EVENT,
} from "./constants.ts";

/** A tmux pane on orc's isolated server. */
export type TmuxPane = {
  /** The orc id of the session this pane belongs to (e.g. `project/feature-a`). */
  sessionId: string;
  /** The tmux pane id (e.g. `%5`). */
  paneId: string;
  /** The pane's current title, as set by the running program via OSC 2. */
  paneTitle: string;
};

/**
 * The persisted core of a session — the basics needed to recreate it after the tmux server is gone.
 * A session's state file holds these fields; everything else on {@link Session} is derived at read
 * time.
 */
export type SessionInfo = {
  /** The project name. */
  project: string;
  /** The session name within the project. */
  session: string;
  /** The fully qualified session id, `project/session`. */
  id: string;
  /** How the project is configured, which determines how its session is started. */
  kind: ProjectKind;
  /** The absolute path to the project's main git repository (not the session's worktree). */
  repositoryRoot: string;
  /** When the session was first created. */
  createdAt: Date;
};

/**
 * A session's lifecycle state: `deleted` when its worktree has been removed (even if tmux is still
 * running it), otherwise `running` when a live tmux session backs it, or `stopped` when not.
 */
export type SessionStatus = (typeof SESSION_STATUSES)[number];

/** An Orc session: its persisted {@link SessionInfo} plus live state derived from tmux at read time. */
export type Session = SessionInfo & {
  /** The session's lifecycle state. */
  status: SessionStatus;
  /** Which worktree the session runs on: the project's main worktree or a dedicated linked one. */
  worktree: "main" | "linked";
  /** Claude agents currently running in this session. Empty when not running. */
  agents: Agent[];
};

/**
 * The tmux-observable fields of a session. Returned by the tmux command layer; the sessions layer
 * joins it with the session's persisted {@link SessionInfo} to build a full {@link Session}.
 */
export type TmuxSession = Pick<Session, "project" | "session" | "id" | "createdAt" | "worktree">;

/** A group of sessions that share a Tmuxinator project. */
export type Project = {
  /** The Tmuxinator project name. */
  project: string;
  /** Sessions belonging to this project, in display order. */
  sessions: Session[];
};

/** How a project is configured: backed by a tmuxinator config, or a plain git repository directory. */
export type ProjectKind = (typeof PROJECT_KINDS)[number];

/**
 * A project a session can be created in. The `kind` discriminates how the project is configured and
 * started: a `tmuxinator` source is backed by a tmuxinator config, while a `directory` source is a
 * local git repository discovered on disk. Both carry the project name and the absolute
 * `repositoryRoot`.
 */
export type ProjectSource = {
  /** Where the project's configuration comes from. */
  kind: ProjectKind;
  /** The project name. */
  name: string;
  /** The absolute path to the project's main git repository (not the session's worktree). */
  repositoryRoot: string;
};

/** The current status of a Claude agent running in an orc session. */
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** A Claude agent running in a tmux pane within an orc session. */
export type Agent = {
  /** The tmux pane id (e.g. `%5`) that hosts the agent. */
  paneId: string;
  /** The current status of the agent. */
  status: AgentStatus;
  /** When the agent last changed status. */
  updatedAt: Date;
};

/** The on-disk shape of an agent state file. */
export type AgentState = {
  /** The current status of the agent. */
  status: AgentStatus;
  /** ISO 8601 timestamp when the state was written. */
  timestamp: string;
};

/** A `UserPromptSubmit` hook payload, restricted to the fields orc consumes. */
export type UserPromptSubmitHookPayload = {
  hook_event_name: typeof USER_PROMPT_SUBMIT_HOOK_EVENT;
};

/** A `Stop` hook payload, restricted to the fields orc consumes. */
export type StopHookPayload = {
  hook_event_name: typeof STOP_HOOK_EVENT;
};

/** A `PostToolUse` hook payload, restricted to the fields orc consumes. */
export type PostToolUseHookPayload = {
  hook_event_name: typeof POST_TOOL_USE_HOOK_EVENT;
};

/**
 * A `Notification` hook payload. Documented `notification_type` values are `permission_prompt`,
 * `idle_prompt`, `auth_success`, `elicitation_dialog`, `elicitation_complete`, and
 * `elicitation_response`.
 */
export type NotificationHookPayload = {
  hook_event_name: typeof NOTIFICATION_HOOK_EVENT;
  notification_type: string;
};

/** The Claude Code hook payloads orc reads from stdin via `orc hook status`. */
export type HookPayload =
  | UserPromptSubmitHookPayload
  | StopHookPayload
  | PostToolUseHookPayload
  | NotificationHookPayload;

/** A single Claude Code hook handler entry. */
export type HookHandler = { type: "command"; command: string };

/** A matcher + handlers group within a Claude Code hook event array. */
export type HookMatcher = { matcher?: string; hooks: HookHandler[] };

/** The shape of a Claude Code settings file (e.g. `.claude/settings.local.json`). */
export type ClaudeSettings = JsonObject & { hooks?: Record<string, HookMatcher[]> };

/** A JSON value: scalar, array, or object. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

/** A JSON object (top-level mapping). */
export type JsonObject = { [key: string]: JsonValue };

/** A YAML scalar, array, or mapping as returned by `Bun.YAML.parse`. Structurally identical to JSON. */
export type YamlValue = JsonValue;

/** A YAML mapping (top-level object). */
export type YamlObject = JsonObject;

/** A tmuxinator project — a YAML object with at least a `name` and `root`. */
export type TmuxinatorProject = YamlObject & { name: string; root: string };
