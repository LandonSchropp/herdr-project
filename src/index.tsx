#!/usr/bin/env bun

import { runCli } from "./cli.ts";
import { App } from "./tui/app.tsx";
import { render } from "ink";

const [command] = process.argv.slice(2);

// The picker Herdr opens as a pane, then the CLI that agents and the plugin's event hooks drive.
if (command === undefined) {
  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
} else {
  const { stdout, stderr, exitCode } = await runCli(process.argv.slice(2));

  if (stdout !== "") process.stdout.write(stdout);
  if (stderr !== "") process.stderr.write(stderr);

  process.exit(exitCode);
}
