import { runHerdr, runHerdrJson } from "./herdr.ts";
import { listProjects } from "./projects.ts";

/** The scope Herdr files the plugin's workspace metadata under. */
const SOURCE = "landonschropp.herdr-project";

/**
 * Extracts the repository root of each open workspace from a `workspace list` response, keyed by
 * workspace id. A workspace without a worktree has no repository, so it contributes nothing.
 *
 * @param response The parsed JSON response from a workspace listing.
 * @returns The repository roots.
 */
export function parseRepositoryRoots(response: unknown): Map<string, string> {
  const workspaces = (response as { result?: { workspaces?: unknown } })?.result?.workspaces;

  if (!Array.isArray(workspaces)) return new Map();

  return new Map(
    workspaces.flatMap((entry: unknown) => {
      const workspace = entry as { workspace_id?: unknown; worktree?: { repo_root?: unknown } };
      const repositoryRoot = workspace.worktree?.repo_root;

      if (typeof workspace.workspace_id !== "string" || typeof repositoryRoot !== "string") {
        return [];
      }

      return [[workspace.workspace_id, repositoryRoot] as [string, string]];
    }),
  );
}

/**
 * Reads the project name of every open workspace. A workspace whose repository is not a configured
 * project has no name, so it contributes nothing.
 *
 * @returns The project names, keyed by workspace id.
 * @throws When Herdr will not list its workspaces.
 */
async function projectNames(): Promise<Map<string, string>> {
  const [repositoryRoots, projects] = await Promise.all([
    runHerdrJson(["workspace", "list"]).then(parseRepositoryRoots),
    listProjects(),
  ]);

  const namesByRoot = new Map(projects.map(({ repositoryRoot, name }) => [repositoryRoot, name]));

  return new Map(
    [...repositoryRoots].flatMap(([workspaceId, repositoryRoot]) => {
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
