# Herdr Project

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A [Herdr](https://herdr.dev) plugin that opens a predefined project and one of its Git worktrees
from a picker.

## Why?

When working in Herdr, it's common to create many workspaces and worktrees, each with the same
standard set of tabs and commands. Recreating that layout by hand every time is a pain, so this
plugin automates it: spin up a workspace or worktree and its tabs come preconfigured, the way
[tmuxinator](https://github.com/tmuxinator/tmuxinator) does for tmux. A `default` project, plus a
glob of the directories your repositories live in, means most projects don't even need a separate
[configuration](#configuration).

## How It Works

One action, two questions:

1. **Which project?** Fuzzy-search the projects you've defined and pick one. Escape cancels.
2. **Which worktree?** Type a branch name and it creates that worktree — or opens it, if it already
   exists. Leave it empty for the project's main checkout. Escape goes back to the project.

Neither answer is inferred from the workspace you were in when you opened the picker, so it works
the same from anywhere. The project's tabs are laid into the workspace afterward; see
[Tabs](#tabs).

## Installation

1. Install [Bun](https://bun.sh) and [Herdr](https://herdr.dev).

2. Install the plugin from a clone:

   ```sh
   git clone https://github.com/LandonSchropp/herdr-project.git
   cd herdr-project
   herdr plugin link .
   ```

3. Bind the action to a key in `~/.config/herdr/config.toml`:

   ```toml
   [[keys.command]]
   key = "cmd+n"
   type = "plugin_action"
   command = "landonschropp.herdr-project.project"
   description = "open a project"
   ```

## CLI

Every step the picker takes is also available non-interactively, so agents and scripts can drive
it.

```sh
herdr-project list [--json]
herdr-project open --project <name> [--worktree <branch>] [--name <label>] [--prompt <text>] [--no-focus]
herdr-project close --project <name> [--worktree <branch>] [--name <label>] [--yes]
```

**`list`** prints each configured project's name and path — an aligned table at a terminal, plain
tab-separated lines when piped. Pass `--json` for the same projects, including their tabs, as a
JSON array instead. Herdr's own `workspace list`/`worktree list` already cover which workspaces and
worktrees are actually open.

**`open`** opens the project's main worktree; with `--worktree`, it creates a worktree on that
branch instead (or opens it, if one already exists). Either way the project's tabs are laid into
the workspace and the new workspace is focused. `--name` labels the workspace, independent of
`--worktree`. `--no-focus` opens it in the background instead, leaving you in the tab you were
already in. A background workspace opens on its first tab rather than its `focusedTab`, since
focusing a tab is what pulls the session over to it. `--prompt` sends the text to the workspace's
agent once it starts, in place of the project's own prompt; see [Prompts](#prompts).

**`close`** closes the project's main workspace; with `--worktree`, it removes that branch's
worktree instead. Either way it asks for confirmation first, as an Ink modal — closing a worktree
deletes its checkout, not just the workspace. `--name` is accepted for symmetry with `open`; the
flag has no effect here. `--yes` skips the confirmation, for running from a script; without it,
`close` requires an interactive terminal and errors immediately otherwise, rather than hanging.

## Tabs

A project's tabs are laid out by a `workspace.created` hook rather than by whatever opened the
workspace, so any workspace whose repository is a configured project gets its tabs — including
ones created from Herdr's own UI, and ones Herdr opens on its own when grouping a worktree under
its parent. Workspaces without a worktree, or whose repository isn't a configured project, are
left alone.

## Project Name

Herdr's sidebar shows a workspace's label, which for a linked worktree is its branch name — useful
for telling worktrees apart, useless for telling which project one belongs to. The plugin reports
each workspace's project name to Herdr as display-only workspace metadata, under a token named
`project`, so a sidebar row can show it as `$project`:

```toml
[ui.sidebar.spaces]
rows = [["state_icon", "workspace"], ["$project"]]
```

The name is the one the picker uses, so a project that declares a name gets that name rather than
its directory's: a repository at `~/.dotfiles` declared as `dotfiles` shows `dotfiles`. A workspace
whose repository isn't a configured project has no project name, so it gets no token and the row is
blank.

The name is reported when the plugin opens a workspace, by the `workspace.created` hook for
workspaces Herdr creates on its own, and again for every open workspace when Herdr starts. The last
of those is what keeps the row filled in across a restart: workspace metadata is display-only, so
Herdr doesn't persist it with the rest of the session.

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
  "flat": true,
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
    { "name": "landonschropp", "path": "~/Development/landonschropp.com" },
    { "path": "~/Notes", "prompt": "Read the vault's conventions before you touch anything." }
  ]
}
```

- **`projectPaths`**: Where to find projects. A path with wildcards is scanned as a glob and every
  Git repository it matches becomes a project named after its directory; a path without wildcards
  is taken as a single repository. This is why most projects need no entry of their own.
- **`flat`**: Whether to open each workspace as its own top-level row rather than as a
  worktree grouped under its repository. Defaults to `false`. (See [Flat
  Workspaces](#flat-workspaces).)
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
something. The reasons that come up:

- **A different name**, when the directory's name isn't what you want to see in the picker (say
  `landonschropp.com` shown as `landonschropp`, or `.dotfiles` as `dotfiles`).
- **A different layout**, when the project wants tabs other than the default's.
- **A prompt**, when the project's agent should always start on the same instructions.

Only `path` is required: `name` defaults to the directory's name, and `tabs` and `focusedTab`
default to the `default` project's. A declared project replaces a discovered one at the same path,
which is how an override takes effect without having to list every other repository.

A declared project's `path` doesn't have to be inside a Git repository. Such a project has no worktrees,
so it always opens as a plain workspace on its directory, which suits a session that works across
repositories rather than in one. Discovery never finds one: `projectPaths` only turns up
repositories.

### Prompts

A project's `prompt` is sent to the agent in its workspace once that agent has started, using
Herdr's own `agent prompt`. It goes to the workspace's first idle agent, whichever tab that is, and
waits for that agent to start on it, so a prompt Herdr never delivered is reported rather than
dropped silently. The agent is idle by construction here, having just started; prompting an agent
that is already working is Herdr's job, not this plugin's.

Unlike tabs, prompts belong to whoever opened the workspace rather than to the `workspace.created`
hook, so a workspace opened from Herdr's own UI gets the project's tabs but not its prompt. That
also keeps `--prompt` and a project's own prompt from both landing in the same agent: the flag
replaces the project's prompt rather than queuing behind it.

### Flat Workspaces

Herdr groups a workspace under its repository, and opening a linked worktree opens that
repository's main workspace alongside it. With `flat`, every workspace the plugin opens
is its own top-level workspace instead.

Herdr doesn't know a flat workspace is a worktree, so the built-in `branch` and `git_status`
sidebar tokens are empty and `herdr worktree remove` refuses it. The workspace's label still
carries the branch, and `herdr-project close` removes the checkout with Git instead.

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
