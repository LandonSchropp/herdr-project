#!/usr/bin/env bash

# Runs the herdr-project picker TUI. Herdr invokes this as the plugin's action and pane entry point.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required to run herdr-project. Install it from https://bun.sh." >&2
  exit 1
fi

exec bun run src/index.tsx
