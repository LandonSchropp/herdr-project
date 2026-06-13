import { stubEnv } from "../../test/helpers/env.ts";
import {
  lastSessionFilePath,
  readLastSession,
  removeLastSession,
  setLastSession,
} from "./last-session.ts";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";

const cacheHome = "/tmp/orc-test-last-session";

beforeEach(() => {
  stubEnv("XDG_CACHE_HOME", cacheHome);
});

afterEach(async () => {
  await rm(cacheHome, { recursive: true, force: true });
});

describe("lastSessionFilePath", () => {
  it("returns a path inside the state directory", () => {
    expect(lastSessionFilePath()).toBe(`${cacheHome}/orc/state/last-session`);
  });
});

describe("setLastSession", () => {
  describe("when the state directory does not exist", () => {
    it("creates the directory and records the id", async () => {
      await setLastSession("project/feature-a");

      expect(await readLastSession()).toBe("project/feature-a");
    });
  });
});

describe("removeLastSession", () => {
  it("clears a previously recorded id", async () => {
    await setLastSession("project/feature-a");
    await removeLastSession();

    expect(await readLastSession()).toBeNull();
  });

  it("is a no-op when nothing was recorded", async () => {
    await removeLastSession();

    expect(await readLastSession()).toBeNull();
  });
});

describe("readLastSession", () => {
  describe("when no id has been recorded", () => {
    it("returns null", async () => {
      expect(await readLastSession()).toBeNull();
    });
  });

  describe("when an id has been recorded", () => {
    it("returns the id", async () => {
      await setLastSession("project/feature-b");

      expect(await readLastSession()).toBe("project/feature-b");
    });
  });
});
