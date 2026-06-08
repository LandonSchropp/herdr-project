import { runDetachedCommand } from "../commands/shell.ts";
import { homedir } from "node:os";

/** Env var set on the detached delete worker so the re-invoked command deletes in-process. */
const DELETE_WORKER_ENVIRONMENT_VARIABLE = "ORC_INTERNAL_DELETE_WORKER";

/**
 * Whether this process is the detached delete worker, which should delete in-process rather than
 * spawning another worker.
 *
 * @returns `true` when the delete-worker flag is set.
 */
export function isDeleteWorker(): boolean {
  return process.env[DELETE_WORKER_ENVIRONMENT_VARIABLE] === "1";
}

/**
 * Spawns a detached worker that deletes the given session, finishing the deletion even after the
 * pane that launched it is killed.
 *
 * @param project The project name.
 * @param session The session name within the project.
 */
export function spawnDeleteWorker(project: string, session: string): void {
  runDetachedCommand([process.execPath, process.argv[1], "delete", project, session], {
    cwd: homedir(),
    env: { [DELETE_WORKER_ENVIRONMENT_VARIABLE]: "1" },
  });
}
