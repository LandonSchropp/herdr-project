import { confirm, isInteractive } from "./confirm.tsx";
import { applyProjectLayout, parseEventWorkspaceId } from "./on-workspace.ts";
import { copyWorktreeIncludes, parseEventWorktreePath } from "./on-worktree.ts";
import { listProjects } from "./projects.ts";
import { collapseHome } from "./settings.ts";
import type { Project } from "./types.ts";
import {
  closeProjectMain,
  closeProjectWorktree,
  createProjectWorktree,
  openProjectMain,
} from "./workspaces.ts";

/** The CLI's usage text, printed for `--help` and for a malformed invocation. */
export const HELP = `herdr-project — open a project and one of its Git worktrees.

Usage:
  herdr-project                                                    Open the project picker.
  herdr-project list [--json]                                      List the configured projects.
  herdr-project open <project> [--worktree <branch>] [--no-focus]  Open a project's workspace.
  herdr-project close <project> [--worktree <branch>] [--yes]      Close a workspace.
  herdr-project --help                                             Show this message.

Commands:
  list   Prints a table with each project's name and path. A JSON array of the same projects,
         including their tabs, with --json. Herdr's own "workspace list"/"worktree list" cover
         which workspaces and worktrees are actually open.
  open   Opens the project's main worktree. With --worktree, creates a worktree on that
         branch instead. Either way the project's tabs are laid into the workspace and the
         new workspace is focused. --no-focus opens it in the background instead, leaving
         you in the tab you were already in.
  close  Closes the project's main workspace, after confirming. With --worktree, removes
         that branch's worktree instead, after confirming its deletion. --yes skips the
         confirmation, for running from a script; without it, close requires an interactive
         terminal and errors otherwise.
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
 * Formats the configured projects for `list`. A human at a terminal gets an aligned table; a script
 * or agent reading a pipe gets plain tab-separated lines instead, which are easier to parse without
 * dealing with column padding.
 *
 * @param projects The projects to format.
 * @param asJson Whether to format them as a JSON array instead, regardless of `isTTY`.
 * @param isTTY Whether stdout is a terminal, which decides between a table and tab-separated lines.
 * @returns The formatted text, ending in a newline.
 */
export function formatProjects(
  projects: Project[],
  asJson: boolean,
  isTTY: boolean = process.stdout.isTTY,
): string {
  if (asJson) {
    return `${JSON.stringify(
      projects.map(({ name, repositoryRoot, tabs }) => ({ name, path: repositoryRoot, tabs })),
      null,
      2,
    )}\n`;
  }

  if (!isTTY) {
    return projects
      .map((project) => `${project.name}\t${collapseHome(project.repositoryRoot)}\n`)
      .join("");
  }

  const header = ["NAME", "PATH"];
  const rows = projects.map((project) => [project.name, collapseHome(project.repositoryRoot)]);
  const widths = header.map((title, index) =>
    Math.max(title.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );

  const formatRow = (values: string[]): string =>
    values
      .map((value, index) =>
        index === values.length - 1 ? value : value.padEnd(widths[index] ?? 0),
      )
      .join("  ");

  return `${[formatRow(header), ...rows.map(formatRow)].join("\n")}\n`;
}

/**
 * Reads the value of a flag from an argument list. Another flag is not a value, so a flag followed
 * by one reads as having none rather than swallowing it.
 *
 * @param args The arguments to search.
 * @param flag The flag whose value to read.
 * @returns The value, or `null` when the flag is absent or has no value.
 */
export function flagValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag);

  if (index === -1) return null;

  const value = args[index + 1];

  return value === undefined || value.startsWith("-") ? null : value;
}

/**
 * Runs the `list` command.
 *
 * @param args The arguments following the command name.
 * @returns The command's result.
 */
async function runList(args: string[]): Promise<CliResult> {
  return {
    stdout: formatProjects(await listProjects(), args.includes("--json")),
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

  const focus = !args.includes("--no-focus");

  if (branch === null) await openProjectMain(project, focus);
  else await createProjectWorktree(project, branch, focus);

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

  const skipConfirmation = args.includes("--yes");

  if (!skipConfirmation && !isInteractive()) {
    return {
      stdout: "",
      stderr: "Error: close requires --yes when not running interactively.\n",
      exitCode: 1,
    };
  }

  const title = branch === null ? "Close Workspace" : "Delete Worktree";
  const description =
    branch === null ? `Close ${project.name}?` : `Delete the "${branch}" worktree?`;

  if (!skipConfirmation && !(await confirm(title, description))) {
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
