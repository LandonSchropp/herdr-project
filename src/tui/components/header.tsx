import { IDLE_AGENT_STATUS, WAITING_AGENT_STATUS, WORKING_AGENT_STATUS } from "../../constants.ts";
import { pluralize } from "../../utilities/string.ts";
import { sessionStatus } from "../state/session-status.ts";
import { useStore } from "../state/store.tsx";
import { Box, Text } from "ink";

/** Top bar of the TUI. Displays the app name on the left and session counts on the right. */
export function Header() {
  const { projects, leftMargin, rightMargin } = useStore();

  const sessions = projects.flatMap((project) => project.sessions);
  const workingCount = sessions.filter(
    (session) => sessionStatus(session) === WORKING_AGENT_STATUS,
  ).length;
  const waitingCount = sessions.filter(
    (session) => sessionStatus(session) === WAITING_AGENT_STATUS,
  ).length;
  const idleCount = sessions.filter(
    (session) => sessionStatus(session) === IDLE_AGENT_STATUS,
  ).length;

  // NOTE: HEADER_HEIGHT in state/constants.ts must match this bar's height; update it if the
  // layout changes.
  return (
    <Box
      backgroundColor="black"
      paddingLeft={leftMargin}
      paddingRight={rightMargin}
      justifyContent="space-between"
    >
      <Text color="white" bold>
        orc
      </Text>
      <Text italic>
        <Text color="blue">
          {projects.length} {pluralize(projects.length, "project")}
        </Text>
        <Text color="gray"> · </Text>
        <Text color="white">
          {sessions.length} {pluralize(sessions.length, "session")}
        </Text>
        <Text color="gray"> · </Text>
        <Text color="green">{workingCount} working</Text>
        <Text color="gray"> · </Text>
        <Text color="yellow">{waitingCount} waiting</Text>
        <Text color="gray"> · </Text>
        <Text color="gray">{idleCount} idle</Text>
      </Text>
    </Box>
  );
}
