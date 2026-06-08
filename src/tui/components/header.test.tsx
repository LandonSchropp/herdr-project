import { sessionFactory } from "../../../test/factories/session.ts";
import { storeFactory } from "../../../test/factories/store.ts";
import { IDLE_AGENT_STATUS, WAITING_AGENT_STATUS, WORKING_AGENT_STATUS } from "../../constants.ts";
import * as storeModule from "../state/store.tsx";
import { Header } from "./header.tsx";
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { render } from "ink-testing-library";

beforeEach(() => {
  spyOn(storeModule, "useStore").mockReturnValue(storeFactory.build());
});

describe("Header", () => {
  it("renders the app name", () => {
    const { lastFrame } = render(<Header />);

    expect(lastFrame()).toContain("orc");
  });

  describe("when there are no sessions", () => {
    it("renders zero counts for everything", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("0 projects");
      expect(lastFrame()).toContain("0 sessions");
      expect(lastFrame()).toContain("0 working");
      expect(lastFrame()).toContain("0 waiting");
      expect(lastFrame()).toContain("0 idle");
    });
  });

  describe("when there is a single project with a single session", () => {
    beforeEach(() => {
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({
          projects: [
            {
              project: "orc",
              sessions: [sessionFactory.build({ project: "orc", session: "a" })],
            },
          ],
        }),
      );
    });

    it("renders the project count in the singular", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("1 project");
      expect(lastFrame()).not.toContain("1 projects");
    });

    it("renders the session count in the singular", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("1 session");
      expect(lastFrame()).not.toContain("1 sessions");
    });
  });

  describe("when there are sessions across multiple projects", () => {
    beforeEach(() => {
      spyOn(storeModule, "useStore").mockReturnValue(
        storeFactory.build({
          projects: [
            {
              project: "orc",
              sessions: [
                sessionFactory.build({
                  project: "orc",
                  session: "a",
                  agents: [{ paneId: "%1", status: WORKING_AGENT_STATUS, updatedAt: new Date() }],
                }),
                sessionFactory.build({
                  project: "orc",
                  session: "b",
                  agents: [{ paneId: "%2", status: WAITING_AGENT_STATUS, updatedAt: new Date() }],
                }),
              ],
            },
            {
              project: "notes",
              sessions: [
                sessionFactory.build({
                  project: "notes",
                  session: "c",
                  agents: [{ paneId: "%3", status: IDLE_AGENT_STATUS, updatedAt: new Date() }],
                }),
              ],
            },
          ],
        }),
      );
    });

    it("renders the project count", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("2 projects");
    });

    it("renders the session count", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("3 sessions");
    });

    it("renders the working count", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("1 working");
    });

    it("renders the waiting count", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("1 waiting");
    });

    it("renders the idle count", () => {
      const { lastFrame } = render(<Header />);

      expect(lastFrame()).toContain("1 idle");
    });
  });
});
