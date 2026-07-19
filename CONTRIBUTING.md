# Contributing

Herdr Project is an opinionated personal tool, built around one particular workflow. Issues and
pull requests are welcome, but the roadmap stays the maintainer's — please open an issue
to discuss a change before investing in a large pull request.

## Setup

The plugin runs directly from source. Follow the [Installation](README.md#installation) steps
in the README to clone the repo and link it into Herdr.

## Before opening a pull request

Run the checks and make sure they pass:

```sh
bun test
bun run lint
bun run check-types
```

## Architecture and conventions

See [AGENTS.md](AGENTS.md) for the layered architecture, naming and file-name conventions, and the
documentation style expected for new code.

## Commits

Keep commits atomic — each commit should capture a single, self-contained logical change.
