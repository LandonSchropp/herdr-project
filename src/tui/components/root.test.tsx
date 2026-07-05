import { Root } from "./root.tsx";
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as ink from "ink";
import { Text } from "ink";
import { render } from "ink-testing-library";

const exit = mock(() => {});

const writeCrashLogMock = mock(() => {});

await mock.module("../../sessions/crash-log.ts", () => ({
  writeCrashLog: writeCrashLogMock,
  crashLogPath: () => "/cache/orc/state/crash.log",
}));

/** Throws during render so the boundary catches it. */
function Boom(): never {
  throw new Error("render boom");
}

let processHandlers: Record<string, (error: unknown) => void>;

beforeEach(() => {
  processHandlers = {};
  spyOn(process, "on").mockImplementation(
    (event: string | symbol, handler: (...args: unknown[]) => void) => {
      processHandlers[event as string] = handler;
      return process;
    },
  );
  spyOn(process, "off").mockReturnValue(process);
  spyOn(ink, "useApp").mockReturnValue({ exit, waitUntilRenderFlush: () => Promise.resolve() });
});

afterEach(() => {
  exit.mockClear();
});

describe("Root", () => {
  describe("when nothing has crashed", () => {
    it("renders its children", () => {
      const { lastFrame } = render(
        <Root>
          <Text>the app</Text>
        </Root>,
      );

      expect(lastFrame()).toContain("the app");
    });
  });

  describe("when a child throws during render", () => {
    it("shows the fatal error screen", () => {
      const { lastFrame } = render(
        <Root>
          <Boom />
        </Root>,
      );

      expect(lastFrame()).toContain("orc crashed");
      expect(lastFrame()).toContain("render boom");
    });

    it("writes a crash log", () => {
      render(
        <Root>
          <Boom />
        </Root>,
      );

      expect(writeCrashLogMock).toHaveBeenCalled();
    });
  });

  describe("when an unhandled rejection occurs", () => {
    it("shows the fatal error screen", async () => {
      const { lastFrame } = render(
        <Root>
          <Text>the app</Text>
        </Root>,
      );

      processHandlers.unhandledRejection(new Error("async boom"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(lastFrame()).toContain("orc crashed");
      expect(lastFrame()).toContain("async boom");
    });
  });

  describe("when an uncaught exception occurs", () => {
    it("shows the fatal error screen", async () => {
      const { lastFrame } = render(
        <Root>
          <Text>the app</Text>
        </Root>,
      );

      processHandlers.uncaughtException(new Error("sync boom"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(lastFrame()).toContain("orc crashed");
      expect(lastFrame()).toContain("sync boom");
    });
  });

  describe("when it unmounts", () => {
    it("removes the process handlers it registered", () => {
      const off = spyOn(process, "off");

      const { unmount } = render(
        <Root>
          <Text>the app</Text>
        </Root>,
      );

      unmount();

      expect(off).toHaveBeenCalledWith("unhandledRejection", processHandlers.unhandledRejection);
      expect(off).toHaveBeenCalledWith("uncaughtException", processHandlers.uncaughtException);
    });
  });
});
