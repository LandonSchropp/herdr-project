import { stubEnv } from "../../test/helpers/env.ts";
import { readSettings, settingsPath } from "./read.ts";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import { homedir } from "node:os";

const configHome = "/tmp/orc-test-settings";
const settingsFilePath = `${configHome}/orc/settings.json`;

describe("settingsPath", () => {
  describe("when $XDG_CONFIG_HOME is set", () => {
    beforeEach(() => {
      stubEnv("XDG_CONFIG_HOME", configHome);
    });

    it("returns settings.json under $XDG_CONFIG_HOME/orc", () => {
      expect(settingsPath()).toBe(`${configHome}/orc/settings.json`);
    });
  });

  describe("when $XDG_CONFIG_HOME is not set", () => {
    beforeEach(() => {
      stubEnv("XDG_CONFIG_HOME", undefined);
    });

    it("returns settings.json under ~/.config/orc", () => {
      expect(settingsPath()).toBe(`${homedir()}/.config/orc/settings.json`);
    });
  });
});

describe("readSettings", () => {
  beforeEach(() => {
    stubEnv("XDG_CONFIG_HOME", configHome);
  });

  afterEach(async () => {
    await rm(configHome, { recursive: true, force: true });
  });

  describe("when the settings file does not exist", () => {
    it("returns the default settings", async () => {
      expect(await readSettings()).toEqual({ projectPaths: [] });
    });
  });

  describe("when the settings file lists project paths", () => {
    beforeEach(async () => {
      await Bun.write(
        settingsFilePath,
        JSON.stringify({ projectPaths: ["/repos/*", "~/Development/*"] }),
      );
    });

    it("returns the paths with a leading ~/ expanded", async () => {
      expect(await readSettings()).toEqual({
        projectPaths: ["/repos/*", `${homedir()}/Development/*`],
      });
    });
  });

  describe("when the settings file omits project paths", () => {
    beforeEach(async () => {
      await Bun.write(settingsFilePath, "{}");
    });

    it("falls back to an empty list", async () => {
      expect(await readSettings()).toEqual({ projectPaths: [] });
    });
  });

  describe("when the settings file fails validation", () => {
    beforeEach(async () => {
      await Bun.write(settingsFilePath, JSON.stringify({ projectPaths: "not-an-array" }));
    });

    it("throws", () => {
      expect(readSettings()).rejects.toThrow();
    });
  });
});
