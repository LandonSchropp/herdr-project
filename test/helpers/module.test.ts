import { stubModule, unstubAllModules } from "./module.ts";
import { afterEach, describe, expect, it } from "bun:test";

afterEach(async () => {
  await unstubAllModules();
});

describe("stubModule", () => {
  it("replaces the module's exports", async () => {
    await stubModule(import.meta.resolve("./module.fixture.ts"), () => ({ value: "stubbed" }));

    const fixture = await import("./module.fixture.ts");

    expect(fixture.value).toEqual("stubbed");
  });
});

describe("unstubAllModules", () => {
  it("restores the module's real exports once the previous test's afterEach has run", async () => {
    const fixture = await import("./module.fixture.ts");

    expect(fixture.value).toEqual("real");
  });
});
