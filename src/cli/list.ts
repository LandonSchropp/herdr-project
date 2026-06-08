import { listSessions } from "../sessions/list.ts";
import type { Session } from "../types.ts";
import { formatTable } from "../utilities/format-table.ts";
import { defineCommand } from "citty";

/** The ANSI escape character (0x1b) that introduces an SGR sequence. */
const ESCAPE = String.fromCharCode(27);

/** The SGR sequence that starts bold blue text. */
const BOLD_BLUE = `${ESCAPE}[1;34m`;

/** The SGR sequence that resets all text styling. */
const RESET = `${ESCAPE}[0m`;

/** Whether output is going to a terminal rather than being piped to another tool. */
const IS_TERMINAL = Boolean(process.stdout.isTTY);

/** The table column headers, in order. */
const HEADERS = ["PROJECT", "SESSION", "WORKTREE", "STATUS", "AGENT"];

/**
 * Wraps a header label in bold blue.
 *
 * @param label The header label.
 * @returns The styled label.
 */
function styleHeader(label: string): string {
  return `${BOLD_BLUE}${label}${RESET}`;
}

/**
 * The label for a session's agent: its status in lowercase, or `n/a` when the session has no
 * agents.
 *
 * @param session The session.
 * @returns The agent label.
 */
function formatSessionAgent(session: Session): string {
  return session.agents[0]?.status.toLowerCase() ?? "n/a";
}

/**
 * A session's cell values, in column order.
 *
 * @param session The session.
 * @returns The cell values.
 */
export function formatSession(session: Session): string[] {
  return [
    session.project,
    session.session,
    session.worktree,
    session.status,
    formatSessionAgent(session),
  ];
}

/**
 * Renders the sessions as a borderless aligned table with a bold blue header, for a terminal.
 *
 * @param sessions The sessions to render.
 * @returns The formatted table.
 */
export function formatSessionTable(sessions: Session[]): string {
  return formatTable([HEADERS.map(styleHeader), ...sessions.map(formatSession)]);
}

/**
 * Renders the sessions as one tab-separated row each, with no header, so the output pipes cleanly
 * to other tools.
 *
 * @param sessions The sessions to render.
 * @returns The tab-separated rows.
 */
export function formatSessionTsv(sessions: Session[]): string {
  return sessions.map((session) => formatSession(session).join("\t")).join("\n");
}

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List Orc sessions",
  },
  async run() {
    const sessions = await listSessions();
    const output = IS_TERMINAL ? formatSessionTable(sessions) : formatSessionTsv(sessions);

    if (output.length > 0) {
      process.stdout.write(`${output}\n`);
    }
  },
});
