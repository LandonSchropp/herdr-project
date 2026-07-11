import { wait } from "./wait.ts";
import { describe, expect, it } from "bun:test";

describe("wait", () => {
  describe("when given a delay", () => {
    it("resolves only after the delay has elapsed", async () => {
      const start = performance.now();
      await wait(50);
      expect(performance.now() - start).toBeGreaterThanOrEqual(45);
    });
  });

  describe("when given a delay of zero", () => {
    it("resolves promptly", async () => {
      const start = performance.now();
      await wait(0);
      expect(performance.now() - start).toBeLessThan(50);
    });
  });

  describe("when given a negative delay", () => {
    it("resolves promptly", async () => {
      const start = performance.now();
      await wait(-100);
      expect(performance.now() - start).toBeLessThan(50);
    });
  });
});
