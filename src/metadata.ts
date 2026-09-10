import { runHerdr } from "./herdr.ts";

/** The scope Herdr files the plugin's workspace metadata under. */
const SOURCE = "landonschropp.herdr-project";

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
