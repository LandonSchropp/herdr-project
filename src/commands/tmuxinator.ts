import { DEFAULT_PROJECT } from "../constants.ts";
import { sessionId } from "../sessions/id.ts";
import type { TmuxinatorProject, YamlObject } from "../types.ts";
import { expandHome } from "../utilities/directory.ts";
import { exists } from "../utilities/exists.ts";
import { xdgConfigHome } from "../utilities/xdg.ts";
import { runCommand } from "./shell.ts";
import { ORC_SOCKET } from "./tmux.ts";
import { YAML } from "bun";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Returns the path to the tmuxinator project config for the given project name. Honors
 * `$XDG_CONFIG_HOME`, falling back to `~/.config` when unset.
 *
 * @param project The tmuxinator project name.
 * @returns The absolute path to the project's YAML config file.
 */
export function tmuxinatorConfigPath(project: string): string {
  return join(xdgConfigHome(), "tmuxinator", `${project}.yml`);
}

/**
 * Checks whether a tmuxinator project config exists for the given project name. Honors
 * `$XDG_CONFIG_HOME`, falling back to `~/.config` when unset.
 *
 * @param project The tmuxinator project name.
 * @returns `true` when the project's YAML config file exists, otherwise `false`.
 */
export async function tmuxinatorProjectExists(project: string): Promise<boolean> {
  return exists(tmuxinatorConfigPath(project));
}

/**
 * Checks if tmuxinator is installed and available on PATH.
 *
 * @returns `true` when tmuxinator is installed, otherwise `false`.
 */
export async function isTmuxinatorInstalled(): Promise<boolean> {
  return (await runCommand(["tmuxinator", "version"])).exitCode === 0;
}

/**
 * Lists the available tmuxinator project names. Excludes the built-in `default` project, which is a
 * tmuxinator scaffold rather than a real orc project.
 *
 * @returns The available tmuxinator project names.
 */
export async function listTmuxinatorProjects(): Promise<string[]> {
  const { stdout } = await runCommand(["tmuxinator", "list", "--newline"]);

  return stdout
    .split("\n")
    .slice(1)
    .filter((line) => line.length > 0)
    .filter((project) => project !== DEFAULT_PROJECT);
}

/**
 * Reads and parses the tmuxinator project config for the given project name. Expands a leading `~/`
 * in the project's `root` to the user's home directory.
 *
 * @param project The tmuxinator project name (the file in `~/.config/tmuxinator/<project>.yml`).
 * @returns The parsed tmuxinator project with an absolute `root` path.
 * @throws If the file cannot be read, the YAML is invalid, or the project is missing a string
 *   `name` or `root` field.
 */
export async function readTmuxinatorProject(project: string): Promise<TmuxinatorProject> {
  const path = tmuxinatorConfigPath(project);
  const parsed = YAML.parse(await Bun.file(path).text()) as YamlObject | null;

  if (typeof parsed?.name !== "string") {
    throw new Error(`Tmuxinator config at ${path} is missing a string \`name\` field`);
  }

  if (typeof parsed.root !== "string") {
    throw new Error(`Tmuxinator config at ${path} is missing a string \`root\` field`);
  }

  return { ...parsed, root: expandHome(parsed.root) } as TmuxinatorProject;
}

/**
 * Starts a tmuxinator project, naming the tmux session `<project>/<session>` and overriding its
 * `root` with the given path. The `template` project supplies the window layout. Does not attach
 * the calling process — callers attach separately.
 *
 * @param project The orc project name, used for the session id.
 * @param session The session name within the project.
 * @param root The root directory to override in the project config.
 * @param template The tmuxinator project whose config provides the window layout. Defaults to
 *   `project`.
 * @throws If the template config cannot be read, or tmuxinator fails to start the project.
 */
export async function startTmuxinatorProject(
  project: string,
  session: string,
  root: string,
  template: string = project,
): Promise<void> {
  const tmuxinatorProject = await readTmuxinatorProject(template);
  const id = sessionId(project, session);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "orc-"));
  const configPath = join(temporaryDirectory, "project.yml");

  await Bun.write(
    configPath,
    YAML.stringify(
      { ...tmuxinatorProject, name: id, root, tmux_options: `-L ${ORC_SOCKET}` },
      null,
      2,
    ),
  );

  const { exitCode, stderr } = await runCommand([
    "tmuxinator",
    "start",
    "-p",
    configPath,
    "--no-attach",
  ]);

  if (exitCode !== 0) {
    throw new Error(`tmuxinator start failed: ${stderr.trim()}`);
  }
}
