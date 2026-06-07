import { createOrSwitchSession } from "../sessions/create-or-switch-session.ts";
import { findSession } from "../sessions/find.ts";
import { sessionId } from "../sessions/id.ts";
import { defineCommand } from "citty";

export const switchCommand = defineCommand({
  meta: {
    name: "switch",
    description: "Switch to an Orc session by name",
  },
  args: {
    project: {
      type: "positional",
      description: "Project name",
      required: true,
    },
    session: {
      type: "positional",
      description: "Session name",
      required: true,
    },
  },
  async run({ args }) {
    const session = await findSession(args.project, args.session);

    if (!session) {
      const name = sessionId(args.project, args.session);
      process.stderr.write(`Session not found: ${name}\n`);
      return process.exit(1);
    }

    await createOrSwitchSession(session);
  },
});
