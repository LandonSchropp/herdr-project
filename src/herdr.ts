import type { Workspace } from "./types.ts";

/** Raised when a `herdr` command is abandoned for outliving its timeout. */
export class HerdrTimeoutError extends Error {
  /** @param message What went wrong. */
  constructor(message: string) {
    super(message);
    this.name = "HerdrTimeoutError";
  }
}

/**
 * Waits for a promise, giving up once a deadline passes.
 *
 * @param promise The promise to wait for.
 * @param timeout How long to wait before giving up, in milliseconds.
 * @returns What `promise` resolved to, or `null` when the deadline passed first.
 */
async function withTimeout<Value>(promise: Promise<Value>, timeout: number): Promise<Value | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads a stream to the end as text.
 *
 * @param reader The reader to drain.
 * @param reader.read Reads the next chunk, reporting `done` once the stream has ended.
 * @returns Everything the stream produced.
 */
async function readAll(reader: {
  read: () => Promise<{ done?: boolean; value?: Uint8Array }>;
}): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();

    if (done === true) break;

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

/** How many times to check whether a server just started is ready, a tenth of a second apart. */
const SERVER_READY_ATTEMPTS = 100;

/**
 * Runs a `herdr` CLI command and returns its raw output. Not every command prints something — `pane
 * run`, for one, prints nothing — so callers that need a response use {@link runHerdrJson}. When no
 * Herdr server is running, a headless one is started and the command retried, so a script launched
 * with no Herdr open still works.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @param timeout How long the command is given, in milliseconds. Omit to leave it unbounded, which
 *   is what a command that does real work needs.
 * @returns Whatever the command wrote to stdout.
 * @throws {HerdrTimeoutError} When the command outlives `timeout`.
 * @throws When the command exits non-zero, or no server is running and one cannot be started.
 */
export async function runHerdr(args: string[], timeout?: number): Promise<string> {
  try {
    return await runHerdrOnce(args, timeout);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("server_not_running")) throw error;

    await startServer();

    return await runHerdrOnce(args, timeout);
  }
}

/**
 * Starts a headless Herdr server that outlives this process, and waits for it to accept commands.
 *
 * @throws When the server is not ready within ten seconds.
 */
async function startServer(): Promise<void> {
  Bun.spawn(["herdr", "server"], { stdio: ["ignore", "ignore", "ignore"], detached: true }).unref();

  for (let attempt = 0; attempt < SERVER_READY_ATTEMPTS; attempt++) {
    const status = JSON.parse(await runHerdrOnce(["status", "server", "--json"])) as {
      running?: unknown;
    };

    if (status.running === true) return;

    await Bun.sleep(100);
  }

  throw new Error("herdr server did not start within ten seconds");
}

/**
 * Runs a `herdr` CLI command once and returns its raw output, as in {@link runHerdr}.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @param timeout How long the command is given, in milliseconds, as in {@link runHerdr}.
 * @returns Whatever the command wrote to stdout.
 * @throws {HerdrTimeoutError} When the command outlives `timeout`.
 * @throws When the command exits non-zero.
 */
async function runHerdrOnce(args: string[], timeout?: number): Promise<string> {
  const process = Bun.spawn(["herdr", ...args], { stdout: "pipe", stderr: "pipe" });

  // Read the output through readers we hold, so abandoning a command releases its streams. A read
  // left pending outlives the command and keeps the process from ever exiting.
  const outputReader = process.stdout.getReader();
  const errorReader = process.stderr.getReader();

  const gathered = Promise.all([readAll(outputReader), readAll(errorReader), process.exited]);

  const result = timeout === undefined ? await gathered : await withTimeout(gathered, timeout);

  if (result === null) {
    process.kill();
    void outputReader.cancel();
    void errorReader.cancel();

    throw new HerdrTimeoutError(`herdr ${args.join(" ")} timed out after ${timeout}ms`);
  }

  const [stdout, stderr, exitCode] = result;

  if (exitCode !== 0) {
    throw new Error(`herdr ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }

  return stdout;
}

/**
 * Runs a `herdr` CLI command that prints JSON and returns the parsed response.
 *
 * @param args The arguments to pass to the `herdr` binary.
 * @param timeout How long the command is given, in milliseconds, as in {@link runHerdr}.
 * @returns The parsed JSON response.
 * @throws {HerdrTimeoutError} When the command outlives `timeout`.
 * @throws When the command exits non-zero or prints output that is not JSON.
 */
export async function runHerdrJson(args: string[], timeout?: number): Promise<unknown> {
  const stdout = await runHerdr(args, timeout);

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`herdr ${args.join(" ")} did not print JSON: ${stdout.trim()}`);
  }
}

/**
 * Extracts the id of the pane Herdr reports after creating a workspace or tab.
 *
 * @param response The parsed JSON response.
 * @returns The pane's id.
 * @throws When the response does not describe a pane.
 */
export function parseRootPaneId(response: unknown): string {
  const paneId = (response as { result?: { root_pane?: { pane_id?: unknown } } } | undefined)
    ?.result?.root_pane?.pane_id;

  if (typeof paneId !== "string") throw new Error("herdr did not report a pane");

  return paneId;
}

/**
 * Extracts the workspace, tab, and pane Herdr reports after creating or opening a workspace.
 *
 * @param response The parsed JSON response.
 * @returns The workspace described by the response.
 * @throws When the response does not describe a workspace.
 */
export function parseWorkspace(response: unknown): Workspace {
  const result = (
    response as
      | { result?: { workspace?: { workspace_id?: unknown }; tab?: { tab_id?: unknown } } }
      | undefined
  )?.result;

  const workspaceId = result?.workspace?.workspace_id;
  const rootTabId = result?.tab?.tab_id;

  if (typeof workspaceId !== "string" || typeof rootTabId !== "string") {
    throw new Error("herdr did not report a workspace");
  }

  return { workspaceId, rootTabId, rootPaneId: parseRootPaneId(response) };
}

/**
 * Extracts the checkout path of the worktree a `worktree create`/`worktree open` response
 * describes.
 *
 * @param response The parsed JSON response.
 * @returns The absolute path to the checkout, or `null` when the response describes no worktree.
 */
export function parseCheckoutPath(response: unknown): string | null {
  const checkoutPath = (
    response as { result?: { workspace?: { worktree?: { checkout_path?: unknown } } } } | undefined
  )?.result?.workspace?.worktree?.checkout_path;

  return typeof checkoutPath === "string" ? checkoutPath : null;
}

/**
 * Extracts the id of the workspace the session is showing from an `api snapshot` response.
 *
 * @param response The parsed JSON response.
 * @returns The workspace's id, or `null` when the response names none.
 */
export function parseFocusedWorkspaceId(response: unknown): string | null {
  const workspaceId = (
    response as { result?: { snapshot?: { focused_workspace_id?: unknown } } } | undefined
  )?.result?.snapshot?.focused_workspace_id;

  return typeof workspaceId === "string" ? workspaceId : null;
}

/**
 * Reads the workspace the session is currently showing.
 *
 * @returns The focused workspace's id, or `null` when no workspace is focused.
 */
export async function focusedWorkspaceId(): Promise<string | null> {
  return parseFocusedWorkspaceId(await runHerdrJson(["api", "snapshot"]));
}
