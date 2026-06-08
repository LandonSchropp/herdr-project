import { compareStrings, pluralize } from "./string.ts";
import { describe, expect, it } from "bun:test";

describe("compareStrings", () => {
  describe("when the first string sorts before the second", () => {
    it("returns a negative number", () => {
      expect(compareStrings("a", "b")).toBeLessThan(0);
    });
  });

  describe("when the first string sorts after the second", () => {
    it("returns a positive number", () => {
      expect(compareStrings("b", "a")).toBeGreaterThan(0);
    });
  });

  describe("when the strings are equal", () => {
    it("returns zero", () => {
      expect(compareStrings("a", "a")).toBe(0);
    });
  });

  describe("when used as a sort comparator", () => {
    it("orders the array alphabetically", () => {
      expect(["orc", "agents", "notes"].toSorted(compareStrings)).toEqual([
        "agents",
        "notes",
        "orc",
      ]);
    });
  });
});

describe("pluralize", () => {
  describe("when the count is one", () => {
    it("returns the singular form", () => {
      expect(pluralize(1, "session")).toBe("session");
    });
  });

  describe("when the count is zero", () => {
    it("returns the plural form", () => {
      expect(pluralize(0, "session")).toBe("sessions");
    });
  });

  describe("when the count is greater than one", () => {
    it("returns the plural form", () => {
      expect(pluralize(2, "session")).toBe("sessions");
    });
  });

  describe("when an explicit plural form is provided", () => {
    it("uses it instead of appending an 's'", () => {
      expect(pluralize(2, "entry", "entries")).toBe("entries");
    });
  });
});
