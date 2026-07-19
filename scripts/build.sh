#!/usr/bin/env bash

# Installs the plugin's dependencies so its Bun entry point can run. Herdr runs this once at install
# time, after you confirm the install and before registering the plugin.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v bun >/dev/null 2>&1; then
  echo "Error: bun is required to build herdr-project. Install it from https://bun.sh." >&2
  exit 1
fi

bun install --frozen-lockfile
