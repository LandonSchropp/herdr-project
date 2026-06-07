import { listSessions } from "../sessions/list.ts";
import { defineCommand } from "citty";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List Orc sessions",
  },
  async run() {
    const sessions = await listSessions();

    for (const { id, status } of sessions) {
      const annotation = status === "running" ? "" : ` (${status})`;
      process.stdout.write(`${id}${annotation}\n`);
    }
  },
});
