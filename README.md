# Herdr Project

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Herdr](https://herdr.dev) plugin that opens a project and one of its Git worktrees from two
pickers.

## Why?

Herdr's project picker opens a project on whatever checkout it happens to be on, and creating a
worktree is a separate, optional detour. This plugin makes the worktree an explicit second step:
pick a project, then pick which of its worktrees to open, with the repository's main checkout
leading the list.

## How It Works

Running the plugin opens a two-step flow:

1. **Pick a project.** Fuzzy-search the projects you've defined and pick one.
2. **Pick a worktree.** The project's worktrees are listed with the repository's main checkout
   first, so it's the default. Pick one to open it into a Herdr workspace, or choose
   **+ New worktree…** to name a branch and create one.

Escape steps back, and escape from the first step exits.

## Installation

1. Install [Bun](https://bun.sh) and [Herdr](https://herdr.dev).

2. Install the plugin from a clone:

   ```sh
   git clone https://github.com/LandonSchropp/herdr-project.git
   cd herdr-project
   herdr plugin link .
   ```

3. Bind it to a key in `~/.config/herdr/config.toml`:

   ```toml
   [[keys.command]]
   key = "cmd+n"
   type = "plugin_action"
   command = "landonschropp.herdr-project.project"
   description = "open a project"
   ```

## CLI

Every step the picker takes is also available non-interactively, so agents and scripts can drive
it. Herdr's own commands cover everything else (switching, closing, listing worktrees).

```sh
herdr-project list [--json]                         # list the configured projects
herdr-project create <project> [--branch <branch>]  # open a project's workspace
```

`list` prints `<name>\t<path>` per line, or a JSON array with `--json`. `create` opens the
project's main worktree; with `--branch` it creates a worktree on that branch instead. Either way
the project's tabs are laid into the new workspace.

## Configuration

Settings live in a single file at `~/.config/herdr-project/settings.json`. Point
`HERDR_PROJECT_SETTINGS` elsewhere to override the location. Every field is optional.

```json
{
  "projectPaths": ["~/Development/*"],
  "defaultTabs": [
    { "name": "shell" },
    { "name": "neovim", "command": "nvim" },
    { "name": "claude", "command": "claude" }
  ],
  "projects": [
    { "name": "dotfiles", "path": "~/.dotfiles" },
    { "name": "notes", "path": "~/Notes" }
  ]
}
```

- **`projectPaths`**: Globs scanned for Git repositories. Every match becomes a project named after
  its directory, laid out with `defaultTabs`. This is the reason most projects need no entry of
  their own.
- **`defaultTabs`**: The tabs opened for a discovered project, and for any declared project that
  omits its own. A tab with no `command` is left as a plain shell.
- **`projects`**: Projects declared explicitly, for repositories outside your project paths or ones
  that want a different name or layout. Only `path` is required: `name` defaults to the directory's
  name and `tabs` to `defaultTabs`. A declared project wins over a discovered one at the same path.

## Development

```sh
bun install
bun test           # run the test suite
bun run check-types
bun run lint
```

Run the picker outside Herdr to iterate on the UI:

```sh
bun run src/index.tsx
```

## Acknowledgements

The picker UI is adapted from [Orc](https://github.com/LandonSchropp/orc), which this repository
was forked from.

## License

[MIT](LICENSE).
