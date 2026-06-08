import { agentFactory } from "../../../test/factories/agent.ts";
import { sessionFactory } from "../../../test/factories/session.ts";
import { storeFactory } from "../../../test/factories/store.ts";
import { WORKING_AGENT_STATUS } from "../../constants.ts";
import * as storeModule from "../state/store.tsx";
import { Session } from "./session.tsx";
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { render } from "ink-testing-library";

beforeEach(() => {
  spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build());
});

describe("Session", () => {
  it("renders the session name", () => {
    const session = sessionFactory.build({ session: "feature-a" });

    const { lastFrame } = render(<Session session={session} />);

    expect(lastFrame()).toContain("feature-a");
  });

  it("renders the agent status", () => {
    const session = sessionFactory.build({
      agents: [agentFactory.build({ status: WORKING_AGENT_STATUS })],
    });

    const { lastFrame } = render(<Session session={session} />);

    expect(lastFrame()).toContain("working");
  });

  describe("when the session has no agents", () => {
    it("renders a no-agents message", () => {
      const session = sessionFactory.build({ agents: [] });

      const { lastFrame } = render(<Session session={session} />);

      expect(lastFrame()).toContain("n/a");
    });
  });

  describe("when the session is not running", () => {
    it("renders the session status", () => {
      const session = sessionFactory.build({ status: "stopped", agents: [] });

      const { lastFrame } = render(<Session session={session} />);

      expect(lastFrame()).toContain("stopped");
    });
  });

  describe("when the session is on the main worktree", () => {
    it("renders the home icon", () => {
      const session = sessionFactory.build({ worktree: "main" });

      const { lastFrame } = render(<Session session={session} />);

      expect(lastFrame()).toContain("\u{F015}");
    });
  });

  describe("when the session name is too long to fit in the card", () => {
    it("truncates the name with an ellipsis", () => {
      const session = sessionFactory.build({
        session: "a-very-long-session-name-that-overflows-the-card",
      });

      const { lastFrame } = render(<Session session={session} />);

      const frame = lastFrame() ?? "";

      expect(frame).toContain("…");
      expect(frame).not.toContain("overflows");
    });
  });

  describe("when the session is on a linked worktree", () => {
    it("renders the tree icon", () => {
      const session = sessionFactory.build({ worktree: "linked" });

      const { lastFrame } = render(<Session session={session} />);

      expect(lastFrame()).toContain("\u{E21C}");
    });
  });
});
