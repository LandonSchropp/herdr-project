import { formatTable } from "./format-table.ts";
import { describe, expect, it } from "bun:test";

/**
 * Wraps text in a green ANSI color so its raw length differs from its visible width.
 *
 * @param text The text to color.
 * @returns The text wrapped in green ANSI codes.
 */
function green(text: string): string {
  return `\u001b[32m${text}\u001b[39m`;
}

describe("formatTable", () => {
  it("left-aligns each column to its widest cell", () => {
    const output = formatTable([
      ["NAME", "STATUS"],
      ["orc/main", "running"],
      ["orc/a", "stopped"],
    ]);

    expect(output).toBe(
      ["NAME         STATUS", "orc/main     running", "orc/a        stopped"].join("\n"),
    );
  });

  it("does not pad the last column, so there is no trailing whitespace", () => {
    const output = formatTable([
      ["a", "bb"],
      ["aaa", "b"],
    ]);

    expect(output).toBe(["a       bb", "aaa     b"].join("\n"));
  });

  it("measures column width by visible width, ignoring ANSI color codes", () => {
    const output = formatTable([
      [green("ok"), "x"],
      ["longer", "y"],
    ]);

    expect(output).toBe([`${green("ok")}         x`, "longer     y"].join("\n"));
  });

  it("returns an empty string when there are no rows", () => {
    expect(formatTable([])).toBe("");
  });
});
