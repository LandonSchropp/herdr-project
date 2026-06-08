import { isMainWorktree } from "../../sessions/main-worktree.ts";
import type { Session as SessionType } from "../../types.ts";
import { COLUMN_WIDTH } from "../state/constants.ts";
import { useStore } from "../state/store.tsx";
import { Status } from "./status.tsx";
import { Box, Text } from "ink";

/** Font Awesome home glyph, marking a session on the project's main worktree. */
const MAIN_WORKTREE_ICON = "\u{F015}";

/** Font Awesome Extended tree glyph, marking a session on a dedicated linked worktree. */
const LINKED_WORKTREE_ICON = "\u{E21C}";

type SessionProps = {
  /** The session to render. */
  session: SessionType;
};

/** A single session showing its worktree marker, name, and status. */
export function Session({ session }: SessionProps) {
  const { selectedSessionId } = useStore();
  const selected = session.id === selectedSessionId;
  const color = selected ? "gray" : "black";
  const worktreeIcon = isMainWorktree(session) ? MAIN_WORKTREE_ICON : LINKED_WORKTREE_ICON;

  // NOTE: SESSION_ROW_HEIGHT in state/constants.ts must match this card's height; update it if the
  // layout changes.
  return (
    <Box width={COLUMN_WIDTH} flexDirection="column">
      <Text color={color}>{"▄".repeat(COLUMN_WIDTH)}</Text>
      <Box flexDirection="column" paddingX={2} backgroundColor={color}>
        <Text bold wrap="truncate-end">
          <Text color="blue">{worktreeIcon}</Text> {session.session}
        </Text>
        <Status session={session} selected={selected} />
      </Box>
      <Text color={color}>{"▀".repeat(COLUMN_WIDTH)}</Text>
    </Box>
  );
}
