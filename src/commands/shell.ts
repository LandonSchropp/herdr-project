import { spawn } from "node:child_process";

/** The result of running a shell command. */
export type RunCommandResult = {
  /** The exit code of the process. */
  exitCode: number;
  /** The standard output of the process. */
  stdout: string;
  /** The standard error of the process. */
  stderr: string;
};

/**
 * Runs a command and captures its output. Returns exit code 127 if the command is not found.
 *
 * @param command The command and its arguments, e.g. `["git", "--version"]`.
 * @returns The exit code, stdout, and stderr from the process.
 */
export async function runCommand(command: string[]): Promise<RunCommandResult> {
  try {
    const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });

    const [stdout, stderr] = await Promise.all([
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    return { exitCode: await process.exited, stdout, stderr };
  } catch (error) {
    // If the command doesn't exist, Bun throws ENOENT
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { exitCode: 127, stdout: "", stderr: "" };
    }

    // Otherwise, let the error pass through
    throw error;
  }
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
