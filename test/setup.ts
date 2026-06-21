import { unstubAllEnvs } from "./helpers/env.ts";
import "./helpers/process.ts";
import { afterEach, beforeEach, mock } from "bun:test";
import * as ink from "ink";

// Mock the terminal size so components render at a deterministic size. Ink otherwise resolves the
// real terminal, which varies between local and CI runs. Exported so a test can override the size
// with `useWindowSizeMock.mockReturnValueOnce(...)`.
export const useWindowSizeMock = mock(() => ({ columns: 100, rows: 30 }));

// The `...ink` spread is required: `mock.module` replaces the module wholesale, so without it the
// other Ink exports (`Box`, `Text`, `render`, ...) become undefined.
await mock.module("ink", () => ({
  ...ink,
  useWindowSize: useWindowSizeMock,
}));

beforeEach(() => {
  mock.clearAllMocks();
});

afterEach(() => {
  unstubAllEnvs();
});
