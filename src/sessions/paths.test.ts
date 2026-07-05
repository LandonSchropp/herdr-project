import { ORC_WORKTREES_DIRECTORY } from "../directories.ts";
import { worktreePath } from "./paths.ts";
import { describe, expect, it } from "bun:test";

describe("worktreePath", () => {
  it("returns the orc cache path for the given project and session", () => {
    expect(worktreePath("test-project", "feature-a")).toBe(
      `${ORC_WORKTREES_DIRECTORY}/test-project/feature-a`,
    );
  });
});
