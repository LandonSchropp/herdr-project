# Agent Instructions

## Architecture

The code is organized in three layers, lowest to highest:

1. **`src/commands/`** — thin wrappers around external CLI tools (`tmux`, `git`, `tmuxinator`) and a generic shell utility (`runCommand`, `runAttachedCommand`). Functions in this layer are tool-specific and keep the tool name in their identifier (e.g. `isTmuxInstalled`, `listTmuxSessions`, `switchTmuxSession`).
2. **`src/sessions/`** — orc-specific logic that composes the low-level commands into operations on the orc domain. Functions here drop the tool qualifier (e.g. `getCurrentSession`, `findMatchingSession`, `switchSession`).
3. **`src/cli/`** — high-level CLI commands defined with citty (`new`, `list`, `switch`, `detach`, `delete`). These wire arguments to the mid-layer functions.

Tests live alongside their source as `*.test.ts`. Shared test infrastructure (`setup.ts`, `factories/`, `helpers/`) lives in `test/`.

## Dependencies

IMPORTANT: When the agent first starts, check to see if a local `node_modules` directory exists. If it doesn't, run `bun install`. This will happen when a session is created in a fresh Git worktree.

## On-Disk Paths

Orc follows the XDG Base Directory Specification for all on-disk data:

- **Config**: `$XDG_CONFIG_HOME` (fallback `~/.config`). Used to locate Tmuxinator project files.
- **Cache / state**: `$XDG_CACHE_HOME` (fallback `~/.cache`). Used for worktrees and any orc-managed runtime state.

When reading or writing new on-disk paths, always go through `process.env.XDG_*` with the specified fallback rather than hardcoding `~/.cache` or `~/.config`. See `src/commands/tmuxinator.ts` for the pattern.

## CLI vs TUI

Orc has two interaction modes:

- **CLI**: every subcommand (`orc <subcommand>`) is non-interactive. All required arguments must be supplied; missing arguments produce an error rather than a prompt or interactive picker. This keeps subcommands predictable for agents and scripts.
- **TUI**: launched by running `orc` with no subcommand. All interactive flows (session selection, confirmations, browsing) live here.

Subcommands never fall back to interactive prompts. If a user needs interaction, they launch the TUI.

## Stale TUI Session

The TUI runs inside a hidden tmux session named `_tui` (the control session, see `src/sessions/control-session.ts`). That session launches orc once and keeps the same process alive, so it goes on running whatever binary it started with. When you change TUI code, a running `_tui` session is stale and will not reflect your edits until it is killed and recreated.

When modifying the TUI, kill the stale control session before re-running orc:

```bash
tmux kill-session -t _tui
```

## CLI Output

Use `process.stdout.write` for command output, not `console.log`. CLI output is program data that should pipe cleanly to other tools — `console.log` is for diagnostics and goes through Node's console formatting layer. Remember to include the trailing `\n` since `process.stdout.write` does not append one.

## Git Workflow

- REQUIRED: invoke the `git-atomic-commit` skill at the start of every session.
- Each commit captures one logical change. Before presenting work, evaluate whether the diff could be split into atomic commits and propose the split.
- Code under review must be unstaged. The unstaged diff should reflect exactly what will be committed — never present a staged diff for review.

## Naming

Avoid unnecessary abbreviations in code identifiers and prose. The test: would you say it aloud when talking to someone? You'd say `config`, `repo`, `id` — those are fine. You wouldn't say `dir`, `func`, or `args` — write `directory`, `function`, and `arguments`. Well-known acronyms like CLI, TUI, XDG, JSON, YAML stay as acronyms.

## File Names

All source and test files use kebab-case (e.g. `agent-status.tsx`, `use-interval.ts`, `session-list.test.tsx`). React component and hook exports keep their conventional casing (`AgentStatus`, `useInterval`); only the filename is kebab-case.

## Documentation

Document every function with a JSDoc comment, including a `@param` line for each parameter and a `@returns` line describing the return value. This applies to private helpers, not only exported functions; omit `@returns` only when the function returns nothing. React components are the exception — document their props on the props type and give the component itself a one-line summary.

Describe _what_ a function does and the contract it honors, not _how_ it does it internally. A reader of the doc comment should learn what to pass and what to expect back, not the implementation steps. Drop details like which command is invoked, the order branches are tried, or that a flag forces an operation — those live in the code and only go stale in the comment. Behavior that callers can observe is fair game: how the return value depends on the arguments, what happens at boundaries, and the conditions under which it throws.

For example, prefer "Returns the repository's default branch, or `null` if none can be determined." over "Tries `origin/HEAD` first, then falls back to a local `main` or `master` branch."
