# Herdr Project

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Herdr](https://herdr.dev) plugin that opens a project and one of its Git worktrees from two
pickers.

## Why?

Two things come up often enough to be worth a dedicated key each: jumping straight to a project's
main checkout, and creating a worktree for whatever project the current workspace belongs to. This
plugin is those two actions — a project picker and a new-worktree prompt — plus CLI equivalents so
a script or agent can drive them without a terminal UI.

## How It Works

Two independent actions, each its own picker:

- **Open a project.** Fuzzy-search the projects you've defined and pick one; it opens on its main
  checkout. Escape cancels.
- **New worktree.** Run from inside an already-open workspace. Type a branch name and it creates
  that worktree for the current workspace's project — or opens it, if it already exists. Escape
  cancels.

Either way, the project's tabs are laid into the workspace afterward; see [Tabs](#tabs).

## Installation

1. Install [Bun](https://bun.sh) and [Herdr](https://herdr.dev).

2. Install the plugin from a clone:

   ```sh
   git clone https://github.com/LandonSchropp/herdr-project.git
   cd herdr-project
   herdr plugin link .
   ```

3. Bind each action to a key in `~/.config/herdr/config.toml`:

   ```toml
   [[keys.command]]
   key = "cmd+n"
   type = "plugin_action"
   command = "landonschropp.herdr-project.project"
   description = "open a project"

   [[keys.command]]
   key = "cmd+shift+n"
   type = "plugin_action"
   command = "landonschropp.herdr-project.worktree"
   description = "create a worktree"
   ```

## CLI

Every step the picker takes is also available non-interactively, so agents and scripts can drive
it.

```sh
herdr-project list [--json]
herdr-project open <project> [--worktree <branch>]
herdr-project close <project> [--worktree <branch>] [--yes]
```

**`list`** prints a table with each project's name, the branch of each of its open worktrees, and
its checkout path — `N/A` for a project with nothing open. A project with several open worktrees
gets one row per worktree. Pass `--json` for the same rows as a JSON array instead of a table.

**`open`** opens the project's main worktree; with `--worktree`, it creates a worktree on that
branch instead (or opens it, if one already exists). Either way the project's tabs are laid into
the workspace.

**`close`** closes the project's main workspace; with `--worktree`, it removes that branch's
worktree instead. Either way it asks for confirmation first, as an Ink modal — closing a worktree
deletes its checkout, not just the workspace. `--yes` skips the confirmation, for running from a
script; without it, `close` requires an interactive terminal and errors immediately otherwise,
rather than hanging.

## Tabs

A project's tabs are laid out by a `workspace.created` hook rather than by whatever opened the
workspace, so any workspace whose repository is a configured project gets its tabs — including
ones created from Herdr's own UI, and ones Herdr opens on its own when grouping a worktree under
its parent. Workspaces without a worktree, or whose repository isn't a configured project, are
left alone.

## Untracked Files

Git leaves untracked files behind when it creates a worktree, so a fresh checkout has no `.env` and
nothing else Git was told to ignore. A `worktree.created` hook copies them in, from the
repository's main checkout into the new worktree, for any repository — configured project or not.

Which files come along is decided by two include files, both optional and both written in
`.gitignore` syntax:

- **`~/.config/git/worktreeinclude`** (or `$XDG_CONFIG_HOME/git/worktreeinclude`): the patterns
  every repository gets, which is where something like `.env*` belongs.
- **`.worktreeinclude`** in a repository's main checkout: that repository's own patterns.

The two are layered the way Git layers its own ignore files: the global patterns apply first and the
repository's apply over them, so a repository wins where the two disagree and can cancel a global
pattern by negating it (`!.env`). The file lives in the main checkout and is read from there — it
isn't committed, so a new worktree never has one of its own.

Only untracked files are copied, since a tracked one is already in the worktree, and a path the
worktree already has is left alone rather than overwritten. A matched directory is copied whole,
which is worth remembering before matching something like `node_modules`: the copy happens while
the workspace is opening.

## Configuration

Settings live in a single file at `~/.config/herdr-project/settings.json`. Point
`HERDR_PROJECT_SETTINGS` elsewhere to override the location. Every field is optional.

```json
{
  "projectPaths": ["~/Development/*", "~/.dotfiles", "~/Notes"],
  "projects": [
    {
      "name": "default",
      "focusedTab": "claude",
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

Its `focusedTab` names the tab to focus when a workspace opens. A name that matches none of a
project's tabs is ignored, so pointing it at a tab like `claude` that most but not all projects
declare is safe: the projects that have it open focused there, and the rest open on their first
tab.

### Declaring a project

Discovery already covers most repositories, so declare a project only when you want to override
something. The two reasons that come up:

- **A different name**, when the directory's name isn't what you want to see in the picker (say
  `landonschropp.com` shown as `landonschropp`, or `.dotfiles` as `dotfiles`).
- **A different layout**, when the project wants tabs other than the default's.

Only `path` is required: `name` defaults to the directory's name, and `tabs` and `focusedTab`
default to the `default` project's. A declared project replaces a discovered one at the same path,
which is how an override takes effect without having to list every other repository.

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
