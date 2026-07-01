import { CommandError } from "../commands/shell.ts";
import { stubEnv } from "../../test/helpers/env.ts";
import { crashLogPath, writeCrashLog } from "./crash-log.ts";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";

const cacheHome = "/tmp/orc-test-crash-cache";

describe("crashLogPath", () => {
  beforeEach(() => {
    stubEnv("XDG_CACHE_HOME", cacheHome);
  });

  it("returns the path under the orc cache directory", () => {
    expect(crashLogPath()).toBe(`${cacheHome}/orc/state/crash.log`);
  });
});

describe("writeCrashLog", () => {
  beforeEach(() => {
    stubEnv("XDG_CACHE_HOME", cacheHome);
  });

  afterEach(async () => {
    await rm(cacheHome, { recursive: true, force: true });
  });

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
