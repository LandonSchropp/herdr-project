#!/usr/bin/env bash

# Opens the picker in a Herdr-managed pane. Herdr runs a plugin action headless, with no terminal
# attached, so the action cannot render the TUI itself — it asks Herdr for a pane running the
# plugin's "picker" entry point instead.

set -euo pipefail

exec herdr plugin pane open \
  --plugin landonschropp.herdr-project \
  --entrypoint picker \
  --placement zoomed \
  --focus
