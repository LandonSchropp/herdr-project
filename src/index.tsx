#!/usr/bin/env bun

import { runCli } from "./cli.ts";
import { App } from "./tui/app.tsx";
import { render } from "ink";

const args = process.argv.slice(2);

// With no arguments this is the interactive picker Herdr launches; with any, it is the CLI agents
// and scripts drive.
if (args.length === 0) {
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
} else {
  const { stdout, stderr, exitCode } = await runCli(args);

  if (stdout !== "") process.stdout.write(stdout);
  if (stderr !== "") process.stderr.write(stderr);

  process.exit(exitCode);
}
