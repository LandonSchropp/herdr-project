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

## Configuration

Projects are TOML files, one per project. Each needs a `name` and a `working_dir` pointing at the
project's Git repository; any other keys are ignored.

```toml
name = "orc"
working_dir = "~/Development/orc"
```

By default these are read from Herdr Plus's projects directory, so an existing Herdr Plus setup
works with no changes:

```
~/.config/herdr/plugins/config/cloudmanic.herdr-plus/projects
```

Point `HERDR_PROJECTS_DIRECTORY` at another directory to read them from somewhere else.

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
