import { unstubAllEnvs } from "./helpers/env.ts";
import "./helpers/process.ts";
import { afterEach, beforeEach, mock } from "bun:test";
import * as ink from "ink";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Give each test process its own on-disk directories. `--isolate` runs every test file in its own
// process, so keying the root on the pid keeps parallel files from sharing state.
const testRoot = join(tmpdir(), `orc-test-${process.pid}`);
const configHome = join(testRoot, "config");
const cacheHome = join(testRoot, "cache");
const orcCache = join(cacheHome, "orc");

// Point orc's directory constants at the test root. Mocking the module (rather than stubbing the
// XDG env vars) sidesteps that `src/directories.ts` freezes those env vars at import.
await mock.module("../src/directories.ts", () => ({
  XDG_CONFIG_HOME: configHome,
  XDG_CACHE_HOME: cacheHome,
  ORC_CONFIG_DIRECTORY: join(configHome, "orc"),
  ORC_CACHE_DIRECTORY: orcCache,
  ORC_STATE_DIRECTORY: join(orcCache, "state"),
  ORC_WORKTREES_DIRECTORY: join(orcCache, "worktrees"),
}));

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

afterEach(async () => {
  unstubAllEnvs();
  await rm(testRoot, { recursive: true, force: true });
});
