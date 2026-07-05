import { ORC_CACHE_DIRECTORY } from "../directories.ts";
import { AgentState } from "../types.ts";
import { readStateFile, removeSessionStateFiles, stateFilePath, writeStateFile } from "./state.ts";
import { beforeEach, describe, expect, it } from "bun:test";

describe("stateFilePath", () => {
  it("returns a flat path encoding project, session, and pane id", () => {
    expect(stateFilePath("test-project", "feature-a", "%5")).toBe(
      `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
    );
  });
});

describe("writeStateFile", () => {
  describe("when the state directory does not exist", () => {
    it("creates the directory and writes the file", async () => {
      await writeStateFile("test-project", "feature-a", "%5", "Working");

      const written = (await Bun.file(
        `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
      ).json()) as unknown as AgentState;

      expect(written.status).toBe("Working");
      expect(typeof written.timestamp).toBe("string");
    });
  });

  it("records an ISO 8601 timestamp", async () => {
    await writeStateFile("test-project", "feature-a", "%5", "Idle");

    const written = (await Bun.file(
      `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
    ).json()) as unknown as AgentState;

    expect(written.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  describe("when the file already exists", () => {
    beforeEach(async () => {
      await writeStateFile("test-project", "feature-a", "%5", "Working");
    });

    it("overwrites the existing state", async () => {
      await writeStateFile("test-project", "feature-a", "%5", "Idle");

      const written = (await Bun.file(
        `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
      ).json()) as unknown as AgentState;

      expect(written.status).toBe("Idle");
    });
  });
});

describe("readStateFile", () => {
  describe("when the file exists", () => {
    beforeEach(async () => {
      await writeStateFile("test-project", "feature-a", "%5", "Waiting");
    });

    it("returns the parsed state", async () => {
      const state = await readStateFile("test-project", "feature-a", "%5");
      expect(state?.status).toBe("Waiting");
      expect(typeof state?.timestamp).toBe("string");
    });
  });

  describe("when the file does not exist", () => {
    it("returns null", async () => {
      expect(await readStateFile("test-project", "feature-a", "%5")).toBeNull();
    });
  });

  describe("when the file is malformed JSON", () => {
    beforeEach(async () => {
      await Bun.write(
        `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
        "{not valid json",
      );
    });

    it("throws an error", () => {
      expect(readStateFile("test-project", "feature-a", "%5")).rejects.toThrow();
    });
  });

  describe("when the file has an invalid shape", () => {
    beforeEach(async () => {
      await Bun.write(
        `${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`,
        JSON.stringify({ status: "Bogus", timestamp: "2026-05-17T00:00:00.000Z" }),
      );
    });

    it("throws an error", () => {
      expect(readStateFile("test-project", "feature-a", "%5")).rejects.toThrow(/invalid/i);
    });
  });
});

describe("removeSessionStateFiles", () => {
  describe("when the session has state files", () => {
    beforeEach(async () => {
      await writeStateFile("test-project", "feature-a", "%5", "Working");
      await writeStateFile("test-project", "feature-a", "%6", "Idle");
    });

    it("removes every state file for the session", async () => {
      await removeSessionStateFiles("test-project", "feature-a");

      expect(
        await Bun.file(`${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%5.json`).exists(),
      ).toBe(false);
      expect(
        await Bun.file(`${ORC_CACHE_DIRECTORY}/state/test-project:feature-a:%6.json`).exists(),
      ).toBe(false);
    });

    it("does not touch files for other sessions", async () => {
      await writeStateFile("other-project", "feature-a", "%7", "Working");

      await removeSessionStateFiles("test-project", "feature-a");

      expect(
        await Bun.file(`${ORC_CACHE_DIRECTORY}/state/other-project:feature-a:%7.json`).exists(),
      ).toBe(true);
    });
  });

  describe("when the session has no state files", () => {
    beforeEach(async () => {
      await writeStateFile("other-project", "feature-z", "%9", "Working");
    });

    it("does not throw and does not touch unrelated files", async () => {
      await removeSessionStateFiles("test-project", "feature-a");

      expect(
        await Bun.file(`${ORC_CACHE_DIRECTORY}/state/other-project:feature-z:%9.json`).exists(),
      ).toBe(true);
    });
  });

  describe("when the state directory does not exist", () => {
    it("does not throw", async () => {
      await removeSessionStateFiles("test-project", "feature-a");
    });
  });
});
