import { agentFactory } from "../../../test/factories/agent.ts";
import { sessionFactory } from "../../../test/factories/session.ts";
import { WORKING_AGENT_STATUS } from "../../constants.ts";
import { Status } from "./status.tsx";
import { describe, expect, it } from "bun:test";
import { render } from "ink-testing-library";

describe("Status", () => {
  describe("when the session is running", () => {
    it("renders the agent status", () => {
      const session = sessionFactory.build({
        status: "running",
        agents: [agentFactory.build({ status: WORKING_AGENT_STATUS })],
      });
      const { lastFrame } = render(<Status session={session} />);
      expect(lastFrame()).toContain("working");
    });
  });

  describe("when the session is stopped", () => {
    it("renders the session status", () => {
      const session = sessionFactory.build({ status: "stopped" });
      const { lastFrame } = render(<Status session={session} />);
      expect(lastFrame()).toContain("stopped");
    });
  });

  describe("when the session is deleted", () => {
    it("renders the session status", () => {
      const session = sessionFactory.build({ status: "deleted" });
      const { lastFrame } = render(<Status session={session} />);
      expect(lastFrame()).toContain("deleted");
    });
  });
});
