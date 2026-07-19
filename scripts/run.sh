#!/usr/bin/env bash

# Runs herdr-project. With no arguments this opens the picker TUI, which is how Herdr invokes it as
# the plugin's pane entry point; any arguments are passed through to the CLI, which is how the
# plugin's event hooks invoke it.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required to run herdr-project. Install it from https://bun.sh." >&2
  exit 1
fi

exec bun run src/index.tsx "$@"
