import { ORC_STATE_DIRECTORY } from "../directories.ts";
import {
  lastSessionFilePath,
  readLastSession,
  removeLastSession,
  setLastSession,
} from "./last-session.ts";
import { describe, expect, it } from "bun:test";
import { join } from "node:path";

describe("lastSessionFilePath", () => {
  it("returns last-session under the orc state directory", () => {
    expect(lastSessionFilePath()).toBe(join(ORC_STATE_DIRECTORY, "last-session"));
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
