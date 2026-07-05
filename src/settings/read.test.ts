import { XDG_CONFIG_HOME } from "../directories.ts";
import { readSettings, settingsPath } from "./read.ts";
import { beforeEach, describe, expect, it } from "bun:test";
import { homedir } from "node:os";

const settingsFilePath = `${XDG_CONFIG_HOME}/orc/settings.json`;

describe("settingsPath", () => {
  it("returns settings.json under $XDG_CONFIG_HOME/orc", () => {
    expect(settingsPath()).toBe(`${XDG_CONFIG_HOME}/orc/settings.json`);
  });
});

describe("readSettings", () => {
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
