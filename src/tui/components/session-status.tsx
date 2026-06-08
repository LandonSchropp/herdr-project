import {
  DELETED_SESSION_STATUS,
  RUNNING_SESSION_STATUS,
  STOPPED_SESSION_STATUS,
} from "../../constants.ts";
import type { SessionStatus as SessionStatusType } from "../../types.ts";
import { Text } from "ink";

/** Nerd-font glyphs per session status. */
const STATUS_ICONS = {
  [STOPPED_SESSION_STATUS]: "\u{F04DB}",
  [DELETED_SESSION_STATUS]: "\u{EA81}",
} as const;

/** Color per session status. */
const STATUS_COLORS = {
  [STOPPED_SESSION_STATUS]: "cyan",
  [DELETED_SESSION_STATUS]: "red",
} as const;

type SessionStatusProps = {
  /** The session's lifecycle status to render. */
  status: SessionStatusType;
};

/**
 * Renders a session's lifecycle status as a colored icon followed by its label. Renders nothing for
 * a running session, whose live activity is shown by AgentStatus instead.
 */
export function SessionStatus({ status }: SessionStatusProps) {
  // A running session's status is its agent activity, which AgentStatus renders; there is nothing
  // for this component to show.
  if (status === RUNNING_SESSION_STATUS) {
    return null;
  }

  const icon = STATUS_ICONS[status];
  const color = STATUS_COLORS[status];

  return (
    <Text italic>
      <Text color={color}>
        {icon} {status}
      </Text>
    </Text>
  );
}
