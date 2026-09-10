import { runHerdr } from "./herdr.ts";
import { listOpenWorkspaces } from "./open-workspaces.ts";
import { listProjects } from "./projects.ts";

/** The scope Herdr files the plugin's workspace metadata under. */
const SOURCE = "landonschropp.herdr-project";

/**
 * Reads the project name of every open workspace, whether Herdr manages the workspace's worktree or
 * not. A workspace showing no checkout, and one whose repository is not a configured project, have
 * no name and contribute nothing.
 *
 * @returns The project names, keyed by workspace id.
 * @throws When Herdr will not list its workspaces.
 */
async function projectNames(): Promise<Map<string, string>> {
  const [workspaces, projects] = await Promise.all([listOpenWorkspaces(), listProjects()]);
  const namesByRoot = new Map(projects.map(({ repositoryRoot, name }) => [repositoryRoot, name]));

  return new Map(
    workspaces.flatMap(({ workspaceId, repositoryRoot }) => {
      const name = namesByRoot.get(repositoryRoot);
      return name === undefined ? [] : [[workspaceId, name] as [string, string]];
    }),
  );
}

/**
 * Sends a project name to Herdr as a workspace's `project` metadata token.
 *
 * @param workspaceId The workspace to report against.
 * @param projectName The project name to report.
 * @throws When Herdr refuses the report.
 */
async function sendReport(workspaceId: string, projectName: string): Promise<void> {
  await runHerdr([
    "workspace",
    "report-metadata",
    workspaceId,
    "--source",
    SOURCE,
    "--token",
    `project=${projectName}`,
  ]);
}

/**
 * Describes a failed report the way the plugin log wants it.
 *
 * @param thrown Whatever the failure threw.
 * @returns The message to report back.
 */
function failure(thrown: unknown): string {
  return `could not report: ${thrown instanceof Error ? thrown.message : String(thrown)}`;
}

/**
 * Reports a project name a caller already knows, without reading anything back from Herdr first. A
 * Herdr that refuses is returned rather than thrown.
 *
 * @param workspaceId The workspace to report against.
 * @param projectName The project name to report.
 * @returns A message describing what was done, for the plugin log.
 */
export async function reportProject(workspaceId: string, projectName: string): Promise<string> {
  try {
    await sendReport(workspaceId, projectName);
  } catch (thrown) {
    return failure(thrown);
  }

  return `reported ${workspaceId}'s project as "${projectName}".`;
}

/**
 * Reports the project name of one workspace, looking it up by the workspace's repository. A
 * workspace with no worktree, one whose repository is not a configured project, an id no open
 * workspace has, and a Herdr that refuses are all returned rather than thrown.
 *
 * @param workspaceId The workspace whose project name to report.
 * @returns A message describing what was done, for the plugin log.
 */
export async function reportWorkspaceProject(workspaceId: string): Promise<string> {
  let projectName: string | undefined;

  try {
    projectName = (await projectNames()).get(workspaceId);
  } catch (thrown) {
    return failure(thrown);
  }

  if (projectName === undefined) {
    return `workspace ${workspaceId} has no project; nothing to report.`;
  }

  return reportProject(workspaceId, projectName);
}

/**
 * Reports the project name of every open workspace. A workspace whose report Herdr refuses is named
 * in the message rather than counted as reported, and a Herdr that will not list its workspaces is
 * returned rather than thrown.
 *
 * @returns A message describing what was done, for the plugin log.
 */
export async function reportOpenWorkspaceProjects(): Promise<string> {
  let names: [string, string][];

  try {
    names = [...(await projectNames())];
  } catch (thrown) {
    return failure(thrown);
  }

  const failures = (
    await Promise.all(
      names.map(([workspaceId, name]) =>
        sendReport(workspaceId, name).then(
          () => null,
          (thrown: unknown) => `${workspaceId}: ${failure(thrown)}`,
        ),
      ),
    )
  ).filter((message) => message !== null);

  const reported = `reported the project of ${names.length - failures.length} workspace(s).`;

  return failures.length === 0 ? reported : `${reported}\n${failures.join("\n")}`;
}
