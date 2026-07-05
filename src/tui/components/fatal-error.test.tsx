import { FatalError } from "./fatal-error.tsx";
import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as ink from "ink";
import { render } from "ink-testing-library";

await mock.module("../../sessions/crash-log.ts", () => ({
  crashLogPath: () => "/cache/orc/state/crash.log",
}));

const exit = mock(() => {});

beforeEach(() => {
  spyOn(ink, "useApp").mockReturnValue({ exit, waitUntilRenderFlush: () => Promise.resolve() });
});

describe("FatalError", () => {
  it("renders the error message", () => {
    const { lastFrame } = render(<FatalError error={new Error("boom")} />);

    expect(lastFrame()).toContain("boom");
  });

  it("tells the user how to quit", () => {
    const { lastFrame } = render(<FatalError error={new Error("boom")} />);

    expect(lastFrame()).toContain("Press q or escape to quit.");
  });

  it("shows where the crash log was written", () => {
    const error = new Error("boom");
    const { lastFrame } = render(<FatalError error={error} />);

    expect(lastFrame()).toContain("Crash log: /cache/orc/state/crash.log");
  });

  describe("when q is pressed", () => {
    it("exits the app", () => {
      const { stdin } = render(<FatalError error={new Error("boom")} />);

      stdin.write("q");

      expect(exit).toHaveBeenCalled();
    });
  });

  describe("when escape is pressed", () => {
    it("exits the app", async () => {
      const { stdin } = render(<FatalError error={new Error("boom")} />);

      // Ink holds a lone escape for ~20ms to disambiguate it from an escape sequence before
      // flushing it as the escape key, so wait past that delay.
      stdin.write(String.fromCharCode(27));
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(exit).toHaveBeenCalled();
    });
  });
});
