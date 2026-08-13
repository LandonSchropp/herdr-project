import { confirm } from "./confirm.ts";
import { applyProjectLayout, parseEventWorkspaceId } from "./on-workspace.ts";
import { copyWorktreeIncludes, parseEventWorktreePath } from "./on-worktree.ts";
import { listProjects } from "./projects.ts";
import type { ProjectRow } from "./types.ts";
import {
  closeProjectMain,
  closeProjectWorktree,
  createProjectWorktree,
  listProjectRows,
  openProjectMain,
} from "./workspaces.ts";

/** The CLI's usage text, printed for `--help` and for a malformed invocation. */
export const HELP = `herdr-project — open a project and one of its Git worktrees.

Usage:
  herdr-project                                    Open the project picker.
  herdr-project list [--json]                      List the projects and their open worktrees.
  herdr-project open <project> [--worktree <branch>] [--prompt <text>] Open a project's workspace.
  herdr-project close <project> [--worktree <branch>] [--yes]          Close a workspace.
  herdr-project --help                                                Show this message.

Commands:
  list   Prints a table with each project's name, the branch of each of its open worktrees, and
         its checkout path — "N/A" for a project with nothing open. A JSON array of the same rows
         with --json.
  open   Opens the project's main worktree. With --worktree, creates a worktree on that
         branch instead. Either way the project's tabs are laid into the workspace. With
         --prompt, hands the text to the project's agent tab through the AGENT_PROMPT
         environment variable.
  close  Closes the project's main workspace, after confirming. With --worktree, removes
         that branch's worktree instead, after confirming its deletion. --yes skips the
         confirmation, for running from a script.
`;

/** The result of a CLI run: what to print where, and the exit code to use. */
export type CliResult = {
  /** Text to write to stdout. */
  stdout: string;
  /** Text to write to stderr. */
  stderr: string;
  /** The process exit code. */
  exitCode: number;
};

/**
 * Formats project rows for `list`.
 *
 * @param rows The rows to format.
 * @param asJson Whether to format them as a JSON array rather than a table.
 * @param isTTY Whether stdout is a terminal, which decides whether "N/A" cells are colored gray.
 * @returns The formatted text, ending in a newline.
 */
export function formatProjectRows(
  rows: ProjectRow[],
  asJson: boolean,
  isTTY: boolean = process.stdout.isTTY,
): string {
  if (asJson) return `${JSON.stringify(rows, null, 2)}\n`;

  const header = ["NAME", "WORKTREE", "PATH"];
  const cells = rows.map((row) => [row.name, row.worktree ?? "N/A", row.path ?? "N/A"]);
  const widths = header.map((title, index) =>
    Math.max(title.length, ...cells.map((cell) => cell[index]?.length ?? 0)),
  );

  const formatRow = (values: string[], gray: boolean): string =>
    values
      .map((value, index) => {
        const padded = index === values.length - 1 ? value : value.padEnd(widths[index] ?? 0);
        return gray && index > 0 && isTTY ? `\x1b[90m${padded}\x1b[0m` : padded;
      })
      .join("  ");

  const lines = [
    formatRow(header, false),
    ...rows.map((row, index) => formatRow(cells[index] ?? [], row.worktree === null)),
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * Reads the value of a flag from an argument list.
 *
 * @param args The arguments to search.
 * @param flag The flag whose value to read.
 * @returns The value, or `null` when the flag is absent or has no value.
 */
export function flagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);

  if (index === -1) return null;

  return args[index + 1] ?? null;
}

/**
 * Runs the `list` command.
 *
 * @param args The arguments following the command name.
 * @returns The command's result.
 */
async function runList(args: string[]): Promise<CliResult> {
  return {
    stdout: formatProjectRows(await listProjectRows(), args.includes("--json")),
    stderr: "",
    exitCode: 0,
  };
}

/**
 * Runs the `open` command.
 *
 * @param args The arguments following the command name.
 * @returns The command's result.
 */
async function runOpen(args: string[]): Promise<CliResult> {
  const name = args[0];

  if (name === undefined || name.startsWith("-")) {
    return { stdout: "", stderr: "Error: open requires a project name.\n", exitCode: 1 };
  }

  const project = (await listProjects()).find((entry) => entry.name === name);

  if (project === undefined) {
    return { stdout: "", stderr: `Error: no project named "${name}".\n`, exitCode: 1 };
  }

  const branch = flagValue(args, "--worktree");

  if (args.includes("--worktree") && branch === null) {
    return { stdout: "", stderr: "Error: --worktree requires a branch name.\n", exitCode: 1 };
  }

  const prompt = flagValue(args, "--prompt");

  if (args.includes("--prompt") && prompt === null) {
    return { stdout: "", stderr: "Error: --prompt requires a value.\n", exitCode: 1 };
  }

  if (branch === null) await openProjectMain(project, prompt ?? undefined);
  else await createProjectWorktree(project, branch, prompt ?? undefined);

  return { stdout: "", stderr: "", exitCode: 0 };
}

/**
 * Runs the `close` command.
 *
 * @param args The arguments following the command name.
 * @returns The command's result.
 */
async function runClose(args: string[]): Promise<CliResult> {
  const name = args[0];

  if (name === undefined || name.startsWith("-")) {
    return { stdout: "", stderr: "Error: close requires a project name.\n", exitCode: 1 };
  }

  const project = (await listProjects()).find((entry) => entry.name === name);

  if (project === undefined) {
    return { stdout: "", stderr: `Error: no project named "${name}".\n`, exitCode: 1 };
  }

  const branch = flagValue(args, "--worktree");

  if (args.includes("--worktree") && branch === null) {
    return { stdout: "", stderr: "Error: --worktree requires a branch name.\n", exitCode: 1 };
  }

  const question = branch === null ? `Close ${project.name}?` : `Delete the "${branch}" worktree?`;

  if (!args.includes("--yes") && !(await confirm(question))) {
    return { stdout: "Cancelled.\n", stderr: "", exitCode: 0 };
  }

  if (branch === null) await closeProjectMain(project);
  else await closeProjectWorktree(project, branch);

  return { stdout: "", stderr: "", exitCode: 0 };
}

/**
 * Runs the `on-workspace` hook. Herdr invokes this for every workspace it creates, so it reports
 * what it decided rather than failing when a workspace isn't one the plugin lays out.
 *
 * @returns The command's result.
 */
async function runOnWorkspace(): Promise<CliResult> {
  const workspaceId = parseEventWorkspaceId(
    process.env.HERDR_PLUGIN_EVENT_JSON,
    process.env.HERDR_WORKSPACE_ID,
  );

  if (workspaceId === null) {
    return { stdout: "", stderr: "Error: no workspace id in the event.\n", exitCode: 1 };
  }

  return { stdout: `${await applyProjectLayout(workspaceId)}\n`, stderr: "", exitCode: 0 };
}

/**
 * Runs the `on-worktree` hook. Herdr invokes this for every worktree it creates, so it reports what
 * it decided rather than failing when a worktree has nothing to copy.
 *
 * @returns The command's result.
 */
async function runOnWorktree(): Promise<CliResult> {
  const worktree = parseEventWorktreePath(process.env.HERDR_PLUGIN_EVENT_JSON);

  if (worktree === null) {
    return { stdout: "", stderr: "Error: no worktree path in the event.\n", exitCode: 1 };
  }

  return { stdout: `${await copyWorktreeIncludes(worktree)}\n`, stderr: "", exitCode: 0 };
}

/**
 * Runs the CLI. An empty argument list is the caller's signal to open the picker instead, which it
 * detects before calling this.
 *
 * @param args The arguments, excluding the executable and script path.
 * @returns The result to print and exit with.
 */
export async function runCli(args: string[]): Promise<CliResult> {
  const [command, ...rest] = args;

  if (command === "--help" || command === "-h") {
    return { stdout: HELP, stderr: "", exitCode: 0 };
  }

  try {
    if (command === "list") return await runList(rest);
    if (command === "open") return await runOpen(rest);
    if (command === "close") return await runClose(rest);
    if (command === "on-workspace") return await runOnWorkspace();
    if (command === "on-worktree") return await runOnWorktree();
  } catch (thrown) {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    return { stdout: "", stderr: `Error: ${message}\n`, exitCode: 1 };
  }

  return { stdout: "", stderr: `${HELP}\nError: unknown command "${command}".\n`, exitCode: 1 };
}
