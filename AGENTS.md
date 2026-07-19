# Agent Instructions

**REQUIRED:** Read `README.md` before doing anything else. It documents the project's purpose, setup, and commands.

## Architecture

The code is organized in layers, lowest to highest:

1. **`src/herdr.ts`** — the `herdr` CLI wrapper. `runHerdr` returns raw output and `runHerdrJson` parses it; not every command prints something, so reach for the raw one when you don't need a response. Response parsing (`parseWorkspace`, `parseRootPaneId`) is separate so it can be tested without a running Herdr session.
2. **`src/worktrees.ts`** and **`src/layout.ts`** — worktree listing/opening/creating, and laying a project's tabs into a workspace.
3. **`src/settings.ts`** and **`src/projects.ts`** — the settings file, plus discovering repositories under the project paths and merging them with the declared projects. The settings file has one project list; the entry named `default` is pulled out of it to become `Settings.defaultTabs` and never reaches the picker.
4. **`src/workspaces.ts`** — composes the layers above into the operations both front ends need: open a worktree, create one, or open a project's main checkout, each laying out the project's tabs.
5. **`src/cli.ts`** and **`src/tui/`** — the two front ends. Both call `workspaces.ts` and nothing lower. `cli.ts` returns a result rather than writing to the process, so it can be tested directly; `app.tsx` owns the picker's state and `components/` holds the modals and their primitives (`Modal`, `Picker`, `Prompt`).

`src/index.tsx` dispatches between them: no arguments opens the picker, any arguments run the CLI. Herdr invokes it through `scripts/run.sh`.

Tests live alongside their source as `*.test.ts` / `*.test.tsx`. Shared test infrastructure (`setup.ts`, `helpers/`) lives in `test/`.

## Modals Need a Sized Parent

`Modal` positions itself absolutely and fills its parent, so it collapses to nothing without a parent that has a width and height. `App` wraps every step in a full-screen `Box` sized from `useWindowSize`, and component tests wrap the modal under test in a fixed-size `Box`. A modal rendered bare will silently render nothing.

## Dependencies

IMPORTANT: When the agent first starts, check to see if a local `node_modules` directory exists. If it doesn't, run `bun install`. This will happen when a session is created in a fresh Git worktree.

## Talking to Herdr

All Herdr interaction goes through the `herdr` CLI, never by reading Herdr's config or state files directly. Read identifiers out of the JSON responses rather than constructing them. The CLI is the authority on its own command syntax — run a command group (e.g. `herdr worktree`) to print its subcommands.

Not every command prints JSON. `pane run` prints nothing at all, so passing it through `runHerdrJson` fails at runtime while looking fine in tests. Check what a command actually prints before choosing a wrapper.

## CLI Output

Use `process.stdout.write` for command output, not `console.log`. CLI output is program data that should pipe cleanly to other tools. Remember to include the trailing `\n` since `process.stdout.write` does not append one. `runCli` returns the text and exit code rather than writing them, so keep the writing in `src/index.tsx`.

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
