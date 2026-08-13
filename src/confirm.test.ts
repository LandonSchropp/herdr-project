import { confirm, isInteractive } from "./confirm.tsx";
import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";
import type { ReactElement } from "react";

/**
 * Wraps ink-testing-library's render, capturing every instance it creates so a test can drive its
 * stdin — {@link confirm} calls this internally and only exposes the resolved answer.
 *
 * @returns The wrapped render function, and the instances it has created so far.
 */
function spyRender() {
  const instances: ReturnType<typeof render>[] = [];

  return {
    render: (element: ReactElement) => {
      const instance = render(element);
      instances.push(instance);
      return instance;
    },
    instances,
  };
}

/**
 * Runs a callback with `process.stdin.isTTY` and `process.stdout.isTTY` set to given values,
 * restoring their original values afterwards.
 *
 * @param stdinIsTTY The value to give `process.stdin.isTTY` for the duration of the callback.
 * @param stdoutIsTTY The value to give `process.stdout.isTTY` for the duration of the callback.
 * @param run The callback to run.
 */
function withTTY(stdinIsTTY: boolean, stdoutIsTTY: boolean, run: () => void): void {
  const originalStdin = process.stdin.isTTY;
  const originalStdout = process.stdout.isTTY;

  process.stdin.isTTY = stdinIsTTY;
  process.stdout.isTTY = stdoutIsTTY;

  try {
    run();
  } finally {
    process.stdin.isTTY = originalStdin;
    process.stdout.isTTY = originalStdout;
  }
}

describe("confirm", () => {
  describe("when the user presses 'y'", () => {
    it("resolves true", async () => {
      const spy = spyRender();
      const promise = confirm("Close Workspace", "Close orc?", spy.render);

      spy.instances[0]?.stdin.write("y");

      expect(await promise).toBe(true);
    });
  });

  describe("when the user presses enter", () => {
    it("resolves false", async () => {
      const spy = spyRender();
      const promise = confirm("Close Workspace", "Close orc?", spy.render);

      spy.instances[0]?.stdin.write("\r");

      expect(await promise).toBe(false);
    });
  });

  describe("when the title and description are rendered", () => {
    it("shows both", () => {
      const spy = spyRender();

      void confirm("Close Workspace", "Close orc?", spy.render);

      const frame = spy.instances[0]?.lastFrame();
      expect(frame).toContain("Close Workspace");
      expect(frame).toContain("Close orc?");
    });
  });
});

describe("isInteractive", () => {
  describe("when stdin and stdout are both a TTY", () => {
    it("returns true", () => {
      withTTY(true, true, () => {
        expect(isInteractive()).toBe(true);
      });
    });
  });

  describe("when stdin is not a TTY", () => {
    it("returns false", () => {
      withTTY(false, true, () => {
        expect(isInteractive()).toBe(false);
      });
    });
  });

  describe("when stdout is not a TTY", () => {
    it("returns false", () => {
      withTTY(true, false, () => {
        expect(isInteractive()).toBe(false);
      });
    });
  });
});
