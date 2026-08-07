import { stubEnv } from "../test/helpers/env.ts";
import {
  pendingPromptsDirectory,
  takePendingPrompt,
  writePendingPrompt,
} from "./pending-prompt.ts";
import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Points `HERDR_PROJECT_PENDING_PROMPTS_DIR` at a fresh temporary directory for the current test.
 *
 * @returns The directory's absolute path.
 */
async function stubPendingPromptsDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "herdr-project-prompts-"));
  stubEnv("HERDR_PROJECT_PENDING_PROMPTS_DIR", directory);
  return directory;
}

describe("pendingPromptsDirectory", () => {
  describe("when no override is set", () => {
    it("defaults under the home directory", () => {
      stubEnv("HERDR_PROJECT_PENDING_PROMPTS_DIR", undefined);

      expect(pendingPromptsDirectory()).toEqual(
        join(homedir(), ".cache/herdr-project/pending-prompts"),
      );
    });
  });

  describe("when an override is set", () => {
    it("expands a leading ~/", () => {
      stubEnv("HERDR_PROJECT_PENDING_PROMPTS_DIR", "~/custom-prompts");

      expect(pendingPromptsDirectory()).toEqual(join(homedir(), "custom-prompts"));
    });
  });
});

describe("writePendingPrompt and takePendingPrompt", () => {
  describe("when a prompt was written for a checkout path", () => {
    it("returns it once and reports none on the next take", async () => {
      await stubPendingPromptsDirectory();

      await writePendingPrompt("/tmp/orc", "fix the bug");

      expect(await takePendingPrompt("/tmp/orc")).toEqual("fix the bug");
      expect(await takePendingPrompt("/tmp/orc")).toBeNull();
    });
  });

  describe("when no prompt was written for a checkout path", () => {
    it("returns null", async () => {
      await stubPendingPromptsDirectory();

      expect(await takePendingPrompt("/tmp/never-written")).toBeNull();
    });
  });

  describe("when checkout paths differ", () => {
    it("keeps their prompts independent", async () => {
      await stubPendingPromptsDirectory();

      await writePendingPrompt("/tmp/orc", "prompt for orc");
      await writePendingPrompt("/tmp/feature", "prompt for feature");

      expect(await takePendingPrompt("/tmp/feature")).toEqual("prompt for feature");
      expect(await takePendingPrompt("/tmp/orc")).toEqual("prompt for orc");
    });
  });
});
