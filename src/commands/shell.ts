import { wait } from "../utilities/wait.ts";
import { spawn } from "node:child_process";

/** How long to wait between {@link runCommand} retries, in milliseconds. */
const RETRY_DELAY = 100;

/** The captured output of a shell command that ran to completion. */
export type RunCommandResult = {
  /** The standard output of the process. */
  stdout: string;
  /** The standard error of the process. */
  stderr: string;
};

/** A {@link RunCommandResult} plus the process exit code, for callers that inspect it. */
export type RunCommandResultWithExitCode = RunCommandResult & {
  /** The exit code of the process. */
  exitCode: number;
};

/**
 * Error thrown by {@link runCommand} when a command exits non-zero and errors are not suppressed.
 * Carries the command and its full output so callers and crash logs can inspect the failure.
 */
export class CommandError extends Error {
  /** The command and its arguments that failed. */
  readonly command: string[];
  /** The non-zero exit code the command returned. */
  readonly exitCode: number;
  /** The standard output the command produced before failing. */
  readonly stdout: string;
  /** The standard error the command produced before failing. */
  readonly stderr: string;

  /**
   * @param command The command and its arguments that failed.
   * @param result The exit code and captured output of the failed command.
   */
  constructor(command: string[], result: RunCommandResultWithExitCode) {
    super(
      `Command failed with exit code ${result.exitCode}: ${command.join(" ")}\n` +
        `${result.stdout}${result.stderr}`,
    );

    this.name = "CommandError";
    this.command = command;
    this.exitCode = result.exitCode;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
  }
}

export function runCommand(
  command: string[],
  options: { error: false },
): Promise<RunCommandResultWithExitCode>;

export function runCommand(
  command: string[],
  options?: { error?: true; retries?: number },
): Promise<RunCommandResult>;
/**
 * Runs a command and captures its output. A command that is not found exits with code 127. When
 * `error` is `true` (the default), a non-zero exit throws; when `false`, it resolves with the exit
 * code instead. When `retries` is set, a failed command is re-run, after a short delay, up to that
 * many more times before the final failure surfaces.
 *
 * @param command The command and its arguments, e.g. `["git", "--version"]`.
 * @param options Options for running the command.
 * @param options.error Whether a non-zero exit throws instead of returning the exit code. Defaults
 *   to `true`. Pass `false` to inspect the exit code yourself.
 * @param options.retries How many additional times to re-run the command, after a short delay, when
 *   it fails. Defaults to `0`. Available only on the throwing path, so it cannot be combined with
 *   `error: false`.
 * @returns The captured output, including the exit code only when `error` is `false`.
 * @throws When the command exits non-zero and `error` is not `false`.
 */
export async function runCommand(
  command: string[],
  options: { error?: boolean; retries?: number } = {},
): Promise<RunCommandResult | RunCommandResultWithExitCode> {
  const { error: throwErrors = true, retries = 0 } = options;

  let result: RunCommandResultWithExitCode;

  try {
    const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });

    const [stdout, stderr] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    result = { exitCode: await process.exited, stdout, stderr };
  } catch (caught) {
    // If the command doesn't exist, Bun throws ENOENT
    if (caught instanceof Error && "code" in caught && caught.code === "ENOENT") {
      result = { exitCode: 127, stdout: "", stderr: "" };
    } else {
      // Otherwise, let the error pass through
      throw caught;
    }
  }

  if (result.exitCode !== 0 && retries > 0) {
    await wait(RETRY_DELAY);
    return runCommand(command, { retries: retries - 1 });
  }

  if (throwErrors && result.exitCode !== 0) {
    throw new CommandError(command, result);
  }

  return result;
}

/**
 * Runs a command with stdio attached to the parent's terminal. Use this for subprocesses (e.g.
 * `tmux attach-session`) that need to take over the terminal. Returns exit code 127 if the command
 * is not found.
 *
 * @param command The command and its arguments.
 * @returns The exit code from the process.
 */
export async function runAttachedCommand(command: string[]): Promise<number> {
  try {
    const process = Bun.spawn(command, {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    return await process.exited;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return 127;
    }
    throw error;
  }
}

/** Options for {@link runDetachedCommand}. */
export type RunDetachedCommandOptions = {
  /** Working directory for the process. Must be a directory that outlives the caller. */
  cwd: string;
  /** Extra environment variables, merged over the caller's environment. */
  env?: Record<string, string>;
};

/**
 * Spawns a command in a fully detached process that keeps running after the caller exits or the
 * caller's tmux pane is killed. The caller cannot observe the process, so the command is
 * responsible for reporting its own failures.
 *
 * @param command The command and its arguments.
 * @param options The working directory and any extra environment variables.
 */
export function runDetachedCommand(command: string[], options: RunDetachedCommandOptions): void {
  const [executable, ...args] = command;

  const child = spawn(executable, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    detached: true,
    stdio: "ignore",
  });

  child.unref();
}
