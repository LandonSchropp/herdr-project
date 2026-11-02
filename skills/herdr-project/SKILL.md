---
name: herdr-project
description: Use when opening a project, or a Git worktree of one, as a Herdr workspace, when listing the projects herdr-project knows about, or when closing a project's workspace or worktree from a script or agent.
---

# Herdr Project

`herdr-project` opens Herdr workspaces for configured projects, with each project's tabs already laid out. It drives the running Herdr app from anywhere on the machine, inside a Herdr pane or not, and starts a headless Herdr server when none is running. It needs `bun` on the `PATH`. Run `herdr-project --help` for the full flag reference.

## Listing Projects

```bash
herdr-project list --json
```

This prints each project's `name`, `path` and `tabs`. The other commands take a project by that `name`, which is not always its directory's name.

## Opening a Workspace

```bash
herdr-project open --project <name> --worktree <branch> --name <label> --prompt '<text>' --no-focus
```

- `--worktree`: Opens that branch's worktree, creating the branch and worktree when they don't exist. Without it, the project's main checkout opens.
- `--name`: Sets the sidebar label. Keep it to two or three words, because the sidebar truncates long labels.
- `--prompt`: Sent to the workspace's agent once it starts, in place of the project's configured prompt. Single-quote it, so the shell doesn't expand backticks or `$`. A value starting with `-` reads as a missing value, so don't open the prompt with a list dash.
- `--no-focus`: Opens the workspace in the background. Pass it unless the user asked to switch to the workspace.

On success it prints nothing, not even a workspace ID; look the workspace up with `herdr workspace list`. With `--prompt`, the command waits until the agent has started on the prompt, which can take up to a minute. A prompt sent any other way before the agent starts is lost without an error, so hand it the task with `--prompt`. If the prompt isn't delivered, the command fails but the workspace stays open.

Opening fails when a workspace is already open on that checkout, or on the main checkout under the same `--name`.

Unless the user's settings make workspaces flat, opening a worktree also opens the project's main workspace beside it. That workspace belongs to the user. Leave it open.

## Closing

```bash
herdr-project close --project <name> --worktree <branch> --yes
```

Without `--worktree`, this closes the project's main workspace; when several are open, `--name` picks which one. With `--worktree`, it deletes that branch's worktree and ignores `--name`. Always pass `--yes`: without a terminal to confirm in, the command refuses to run.

`close --worktree` refuses a checkout with uncommitted changes, but it never checks whether the branch's commits are merged or pushed, and it leaves the branch behind. **REQUIRED:** Before running it, confirm the branch is merged into the default branch or pushed to `origin`. Commits that lived only in the checkout are lost.

Close a workspace from the agent working inside it, never from the agent that opened it. Only the agent doing the work knows whether that work has landed.

## Rationalizations

| Thought                                              | Reality                                                                     |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| "`open` printed nothing, so it failed"               | Success prints nothing. Find the workspace with `herdr workspace list`.     |
| "`close` would refuse if any work were at risk"      | It refuses only uncommitted changes. Unpushed commits are deleted silently. |
| "I opened the workspace, so I'll close it"           | The agent inside it closes it, once it knows its work has landed.           |
| "A second workspace opened, so I'll close the extra" | That's the project's main workspace. It belongs to the user.                |
