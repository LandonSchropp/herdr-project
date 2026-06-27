import { getCallerSession } from "../sessions/caller-session.ts";
import { defineCommand } from "citty";

export const callerSessionCommand = defineCommand({
  meta: {
    name: "caller-session",
    description: "Print the project and session the command is run from",
  },
  async run() {
    const callerSession = await getCallerSession();

    if (!callerSession) {
      process.stderr.write("Not inside an Orc session\n");
      return process.exit(1);
    }

    const [project, session] = callerSession;
    process.stdout.write(`${project}\t${session}\n`);
  },
});
