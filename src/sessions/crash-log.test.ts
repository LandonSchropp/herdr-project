import { CommandError } from "../commands/shell.ts";
import { ORC_STATE_DIRECTORY } from "../directories.ts";
import { crashLogPath, writeCrashLog } from "./crash-log.ts";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("crashLogPath", () => {
  it("returns crash.log under the orc state directory", () => {
    expect(crashLogPath()).toBe(join(ORC_STATE_DIRECTORY, "crash.log"));
  });
});

describe("writeCrashLog", () => {
  describe("when the value is an Error", () => {
    it("writes the error's stack to the crash log", () => {
      const error = new Error("boom");

      writeCrashLog(error);

      expect(readFileSync(crashLogPath(), "utf8")).toContain(error.stack!);
    });
  });

  describe("when the value is a CommandError", () => {
    it("captures the failed command's output", () => {
      const error = new CommandError(["sh", "-c", "echo out; exit 3"], {
        exitCode: 3,
        stdout: "out",
        stderr: "",
      });

      writeCrashLog(error);

      expect(readFileSync(crashLogPath(), "utf8")).toContain("out");
    });
  });

  describe("when the value is not an Error", () => {
    it("writes an inspection of the value", () => {
      writeCrashLog({ unexpected: true });

      expect(readFileSync(crashLogPath(), "utf8")).toContain("unexpected");
    });
  });

  describe("when called more than once", () => {
    it("appends each entry", () => {
      writeCrashLog(new Error("first"));
      writeCrashLog(new Error("second"));

      const log = readFileSync(crashLogPath(), "utf8");

      expect(log).toContain("first");
      expect(log).toContain("second");
    });
  });

  it("returns the crash log path", () => {
    expect(writeCrashLog(new Error("boom"))).toBe(crashLogPath());
  });
});
