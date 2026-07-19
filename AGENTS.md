# Agent Instructions

## Architecture

The code is organized in three layers, lowest to highest:

1. **`src/worktrees.ts`** — a thin wrapper around the `herdr` CLI. Every function shells out to `herdr ... --json` and parses the response. Parsing is split from the shelling out (`parseWorktrees`, `sortWorktrees`) so it can be tested without a running Herdr session.
2. **`src/projects.ts`** — loads the project definitions that populate the first picker. Projects are TOML files with a `name` and a `working_dir`; everything else is ignored.
3. **`src/tui/`** — the Ink UI. `app.tsx` owns the flow's state and is the only place that calls the layers below; `components/` holds the modals and the primitives they build on (`Modal`, `Picker`, `Prompt`).

`src/index.tsx` is the entry point Herdr invokes through `scripts/run.sh`.

Tests live alongside their source as `*.test.ts` / `*.test.tsx`. Shared test infrastructure (`setup.ts`, `helpers/`) lives in `test/`.

## Modals Need a Sized Parent

`Modal` positions itself absolutely and fills its parent, so it collapses to nothing without a parent that has a width and height. `App` wraps every step in a full-screen `Box` sized from `useWindowSize`, and component tests wrap the modal under test in a fixed-size `Box`. A modal rendered bare will silently render nothing.

## Dependencies

IMPORTANT: When the agent first starts, check to see if a local `node_modules` directory exists. If it doesn't, run `bun install`. This will happen when a session is created in a fresh Git worktree.

## Talking to Herdr

All Herdr interaction goes through the `herdr` CLI with `--json`, never by reading Herdr's config or state files directly. Read identifiers out of the JSON responses rather than constructing them. The CLI is the authority on its own command syntax — run a command group (e.g. `herdr worktree`) to print its subcommands.

## Git Workflow

- REQUIRED: invoke the `git-atomic-commit` skill at the start of every session.
- Each commit captures one logical change. Before presenting work, evaluate whether the diff could be split into atomic commits and propose the split.
- Code under review must be unstaged. The unstaged diff should reflect exactly what will be committed — never present a staged diff for review.

## Naming

Avoid unnecessary abbreviations in code identifiers and prose. The test: would you say it aloud when talking to someone? You'd say `config`, `repo`, `id` — those are fine. You wouldn't say `dir`, `func`, or `args` — write `directory`, `function`, and `arguments`. Well-known acronyms like CLI, TUI, JSON, TOML stay as acronyms.

## File Names

All source and test files use kebab-case (e.g. `worktree-picker-modal.tsx`, `use-effect-async.ts`). React component and hook exports keep their conventional casing (`WorktreePickerModal`, `useEffectAsync`); only the filename is kebab-case.

## Documentation

Document every function with a JSDoc comment, including a `@param` line for each parameter and a `@returns` line describing the return value. This applies to private helpers, not only exported functions; omit `@returns` only when the function returns nothing. React components are the exception — document their props on the props type and give the component itself a one-line summary.

Describe _what_ a function does and the contract it honors, not _how_ it does it internally. A reader of the doc comment should learn what to pass and what to expect back, not the implementation steps. Drop details like which command is invoked, the order branches are tried, or that a flag forces an operation — those live in the code and only go stale in the comment. Behavior that callers can observe is fair game: how the return value depends on the arguments, what happens at boundaries, and the conditions under which it throws.

For example, prefer "Returns the repository's default branch, or `null` if none can be determined." over "Tries `origin/HEAD` first, then falls back to a local `main` or `master` branch."
