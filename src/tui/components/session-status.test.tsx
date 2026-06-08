import { SessionStatus } from "./session-status.tsx";
import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";

const STOPPED_ICON = "\u{F04DB}";
const DELETED_ICON = "\u{EA81}";

describe("SessionStatus", () => {
  describe("when the status is stopped", () => {
    it("renders the stop icon", () => {
      const { lastFrame } = render(<SessionStatus status="stopped" />);
      expect(lastFrame()).toContain(STOPPED_ICON);
    });

    it("renders the stopped label", () => {
      const { lastFrame } = render(<SessionStatus status="stopped" />);
      expect(lastFrame()).toContain("stopped");
    });
  });

  describe("when the status is deleted", () => {
    it("renders the trash icon", () => {
      const { lastFrame } = render(<SessionStatus status="deleted" />);
      expect(lastFrame()).toContain(DELETED_ICON);
    });

    it("renders the deleted label", () => {
      const { lastFrame } = render(<SessionStatus status="deleted" />);
      expect(lastFrame()).toContain("deleted");
    });
  });

  describe("when the status is running", () => {
    it("renders nothing", () => {
      const { lastFrame } = render(<SessionStatus status="running" />);
      expect(lastFrame()).toBe("");
    });
  });
});
