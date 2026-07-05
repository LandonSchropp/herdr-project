import { ORC_STATE_DIRECTORY } from "../directories.ts";
import { hookLogPath, logHookEvent } from "./hook-log.ts";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

const mkdirMock = mock(() => Promise.resolve());
const appendFileMock = mock(() => Promise.resolve());

await mock.module("node:fs/promises", () => ({
  mkdir: mkdirMock,
  appendFile: appendFileMock,
}));

beforeEach(() => {
  mkdirMock.mockResolvedValue(undefined);
  appendFileMock.mockResolvedValue(undefined);
});

afterEach(() => {
  mkdirMock.mockReset();
  appendFileMock.mockReset();
});

describe("hookLogPath", () => {
  it("returns hook.log under the orc state directory", () => {
    expect(hookLogPath()).toBe(join(ORC_STATE_DIRECTORY, "hook.log"));
  });
});

describe("logHookEvent", () => {
  it("ensures the state directory exists before appending", async () => {
    await logHookEvent("%5", { hook_event_name: "Stop" });

    expect(mkdirMock).toHaveBeenCalledWith(ORC_STATE_DIRECTORY, { recursive: true });
  });

  it("appends a JSON line capturing the pane id and the full payload", async () => {
    const payload = { hook_event_name: "Notification", message: "Claude needs your permission" };

    await logHookEvent("%5", payload);

    expect(appendFileMock).toHaveBeenCalledTimes(1);
    const [path, line] = appendFileMock.mock.calls[0] as unknown as [string, string];
    expect(path).toBe(join(ORC_STATE_DIRECTORY, "hook.log"));
    expect(line.endsWith("\n")).toBe(true);
    const entry = JSON.parse(line) as { timestamp: string; paneId: string; payload: unknown };
    expect(entry).toMatchObject({ paneId: "%5", payload });
    expect(typeof entry.timestamp).toBe("string");
  });

  describe("when appendFile fails", () => {
    it("swallows the error so the hook still completes", async () => {
      appendFileMock.mockRejectedValue(new Error("disk full"));

      // If logHookEvent rejected, this `await` would throw and the test would fail.
      await logHookEvent("%5", { hook_event_name: "Stop" });
    });
  });
});
