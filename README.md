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
2. **Name the worktree.** The input is prefilled with the repository's main checkout, so pressing
   enter opens the project where it already sits. Type another branch name to open that branch's
   worktree, creating one if it doesn't exist yet.

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
project's main worktree; with `--branch` it creates a worktree on that branch instead.

## Tabs

A project's tabs are laid out by a `workspace.created` hook rather than by whatever opened the
workspace, so any workspace whose repository is a configured project gets its tabs — including
ones created from Herdr's own UI, and ones Herdr opens on its own when grouping a worktree under
its parent. Workspaces without a worktree, or whose repository isn't a configured project, are
left alone.

## Configuration

Settings live in a single file at `~/.config/herdr-project/settings.json`. Point
`HERDR_PROJECT_SETTINGS` elsewhere to override the location. Every field is optional.

```json
{
  "projectPaths": ["~/Development/*", "~/.dotfiles", "~/Notes"],
  "projects": [
    {
      "name": "default",
      "tabs": [
        { "name": "shell" },
        { "name": "neovim", "command": "nvim" },
        { "name": "claude", "command": "claude" }
      ]
    },
    { "name": "landonschropp", "path": "~/Development/landonschropp.com" }
  ]
}
```

- **`projectPaths`**: Where to find projects. A path with wildcards is scanned as a glob and every
  Git repository it matches becomes a project named after its directory; a path without wildcards
  is taken as a single repository. This is why most projects need no entry of their own.
- **`projects`**: Project definitions, each merged over the `default` project below.

### The `default` project

The project named `default` is a layout rather than somewhere to open. It has no `path`, never
appears in the picker, and supplies the tabs every other project inherits. A tab with no `command`
is left as a plain shell. Without a `default` project, projects get a single shell.

### Declaring a project

Discovery already covers most repositories, so declare a project only when you want to override
something. The two reasons that come up:

- **A different name**, when the directory's name isn't what you want to see in the picker (say
  `landonschropp.com` shown as `landonschropp`, or `.dotfiles` as `dotfiles`).
- **A different layout**, when the project wants tabs other than the default's.

Only `path` is required: `name` defaults to the directory's name and `tabs` to the `default`
project's. A declared project replaces a discovered one at the same path, which is how an override
takes effect without having to list every other repository.

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
