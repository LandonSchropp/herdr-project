import { orc } from "./orc.ts";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "citty";
import { runCommand } from "citty";

const runTuiMock = mock(() => Promise.resolve());
const startTuiSessionMock = mock(() => Promise.resolve());
const shouldRenderTuiMock = mock((): boolean => false);

await mock.module("../tui/index.tsx", () => ({
  runTui: runTuiMock,
}));

await mock.module("../sessions/tui-session.ts", () => ({
  startTuiSession: startTuiSessionMock,
  shouldRenderTui: shouldRenderTuiMock,
}));

beforeEach(() => {
  shouldRenderTuiMock.mockReturnValue(false);
});

describe("orc", () => {
  describe("when run without a subcommand and the TUI should render", () => {
    it("launches the TUI", async () => {
      shouldRenderTuiMock.mockReturnValue(true);

      await runCommand(orc, { rawArgs: [] });

      expect(runTuiMock).toHaveBeenCalled();
      expect(startTuiSessionMock).not.toHaveBeenCalled();
    });
  });

  describe("when run without a subcommand and the TUI should not render", () => {
    it("enters the TUI session", async () => {
      await runCommand(orc, { rawArgs: [] });

      expect(startTuiSessionMock).toHaveBeenCalled();
      expect(runTuiMock).not.toHaveBeenCalled();
    });
  });

  describe("when run with a subcommand", () => {
    it("does nothing", async () => {
      // Called directly rather than through `runCommand` so the real subcommand doesn't execute.
      // citty invokes the parent `run` after dispatching a subcommand, which is the path guarded.
      const context = { rawArgs: ["hook", "status"] } as CommandContext;

      await orc.run?.(context);

      expect(runTuiMock).not.toHaveBeenCalled();
      expect(startTuiSessionMock).not.toHaveBeenCalled();
    });
  });
});
