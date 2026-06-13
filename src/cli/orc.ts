import { attachOrSwitchToTuiSession, shouldRenderTui } from "../sessions/tui-session.ts";
import { deleteCommand } from "./delete.ts";
import { detachCommand } from "./detach.ts";
import { hookCommand } from "./hook.ts";
import { listCommand } from "./list.ts";
import { newCommand } from "./new.ts";
import { switchCommand } from "./switch.ts";
import { defineCommand } from "citty";

export const orc = defineCommand({
  meta: {
    name: "orc",
    description: "CLI orchestrator for parallel agents using Git worktrees, tmux and Tmuxinator",
  },
  subCommands: {
    new: newCommand,
    list: listCommand,
    switch: switchCommand,
    detach: detachCommand,
    delete: deleteCommand,
    hook: hookCommand,
  },
  async run({ rawArgs }) {
    // Citty runs a parent command's `run` even after it dispatches a subcommand, so only launch the
    // TUI when orc was invoked with no subcommand. Otherwise subcommands boot the TUI, which never
    // exits and hangs the process.
    if (rawArgs.length > 0) return;

    // When re-invoked from inside the TUI session, render the TUI directly. Otherwise enter the TUI
    // session, which runs this command from inside itself.
    if (shouldRenderTui()) {
      // The import is lazy so subcommands never load the Ink/React module graph at all.
      const { runTui } = await import("../tui/index.tsx");
      await runTui();
      return;
    }

    await attachOrSwitchToTuiSession();
  },
});
