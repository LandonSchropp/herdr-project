import { confirm } from "./confirm.ts";
import { describe, expect, it } from "bun:test";
import { Readable, Writable } from "node:stream";

/**
 * Builds a readable stream that yields a single line, as if a user typed it and pressed enter.
 *
 * @param line The line to yield.
 * @returns The readable stream.
 */
function inputLine(line: string): Readable {
  return Readable.from([`${line}\n`]);
}

/** A writable stream that discards everything written to it. */
const devNull = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});

describe("confirm", () => {
  describe("when the answer is 'y'", () => {
    it("returns true", async () => {
      expect(await confirm("Close orc?", inputLine("y"), devNull)).toBe(true);
    });
  });

  describe("when the answer is 'yes'", () => {
    it("returns true", async () => {
      expect(await confirm("Close orc?", inputLine("yes"), devNull)).toBe(true);
    });
  });

  describe("when the answer is 'Y' in any case", () => {
    it("returns true", async () => {
      expect(await confirm("Close orc?", inputLine("Y"), devNull)).toBe(true);
    });
  });

  describe("when the answer is empty", () => {
    it("returns false", async () => {
      expect(await confirm("Close orc?", inputLine(""), devNull)).toBe(false);
    });
  });

  describe("when the answer is anything else", () => {
    it("returns false", async () => {
      expect(await confirm("Close orc?", inputLine("n"), devNull)).toBe(false);
    });
  });
});
