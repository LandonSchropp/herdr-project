import { stubModule } from "../test/helpers/module.ts";
import { reportProject } from "./metadata.ts";
import { describe, expect, it, mock } from "bun:test";

/**
 * Replaces the herdr module so the metadata helpers can be exercised without a running Herdr
 * session.
 *
 * @returns The mocks standing in for each replaced function.
 */
async function mockModules() {
  const mocks = { runHerdr: mock(() => Promise.resolve("")) };

  await stubModule(import.meta.resolve("./herdr.ts"), () => ({ runHerdr: mocks.runHerdr }));

  return mocks;
}

describe("reportProject", () => {
  it("reports the name as the project token", async () => {
    const mocks = await mockModules();

    await reportProject("wI", "dotfiles");

    expect(mocks.runHerdr).toHaveBeenCalledWith([
      "workspace",
      "report-metadata",
      "wI",
      "--source",
      "landonschropp.herdr-project",
      "--token",
      "project=dotfiles",
    ]);
  });

  describe("when Herdr refuses the report", () => {
    it("returns the failure rather than throwing", async () => {
      const mocks = await mockModules();
      mocks.runHerdr.mockRejectedValue(new Error("herdr is not listening"));

      expect(await reportProject("wI", "dotfiles")).toContain("herdr is not listening");
    });
  });
});
