# TODO VS Code Number Bumper

A VS Code extension for keeping numbered TODO comments sequential in the current file.

## Features

- Renumber numbered TODO comments in the active file.
- Insert a new numbered TODO after the nearest preceding TODO.
- Optionally renumber TODOs after saving a file.
- Preserve pinned TODOs such as `TODO #99 [pin]: External tracker`.
- Exclude generated, vendor, or data dump files with glob patterns.
- Use the `todo-numbers` CLI from terminals, CI jobs, and coding agents.
- Generate agent handoff packs, prompt templates, and optional agent skill docs under `.todo-verbose/`.

## Supported Formats

```ts
TODO #1: text
// TODO #1: text
# TODO #1: text
<!-- TODO #1: text -->
```

## Commands

VS Code commands:

- `Todo Numbers: Renumber Current File`
- `Todo Numbers: Insert TODO After Current`
- `Todo Numbers: Toggle Auto Renumber On Save`
- `Todo Numbers: Create Agent Handoff`
- `Todo Numbers: Install Agent Skill`

CLI commands:

```sh
todo-numbers scan [root]
todo-numbers check [root]
todo-numbers fix [root]
todo-numbers handoff [root]
todo-numbers agent-skill install [root]
todo-numbers agent-skill verify [root]
```

`scan` prints structured JSON by default. `check` exits with code `1` when renumbering is needed. `fix` applies deterministic number-only edits.
`handoff` creates `.todo-verbose/handoffs/<timestamp>/` with `HANDOFF.md`, `prompt.md`, `todos.json`, and optional Git diff metadata.

From a source checkout, run the CLI as:

```sh
node ./out/src/cli.js scan . --json
```

Agent handoff examples:

```sh
node ./out/src/cli.js handoff . --prompt-only
node ./out/src/cli.js handoff . --include-diff --json
node ./out/src/cli.js handoff . --apply-renumber --include-diff --json
node ./out/src/cli.js agent-skill install . --target claude-code --json
node ./out/src/cli.js agent-skill verify . --target claude-code --json
```

The handoff flow writes generated prompt and adapter templates under `.todo-verbose/`, which is gitignored. Agent skill installation is explicit: Marketplace installation does not silently mutate Claude Code, Codex, or other agent configuration.

The `todo-numbers` binary is available when the package is linked or installed through npm-compatible tooling. Installing the VS Code extension from the Marketplace does not automatically add shell commands to `PATH`.

The CLI binary name is code-level configurable in `todo-numbers.config.json`:

```json
{
  "cliEntrypoint": "todo-numbers"
}
```

Changing that value and running `npm run sync:cli-entrypoint` updates the package `bin` entry. This is intentionally not exposed as a VS Code user setting.

## Example

Before:

```ts
// TODO #1: Setup API
// TODO #3: Add tests
// TODO #99 [pin]: External tracker
// TODO #5: Clean up
```

After running `Todo Numbers: Renumber Current File`:

```ts
// TODO #1: Setup API
// TODO #2: Add tests
// TODO #99 [pin]: External tracker
// TODO #3: Clean up
```

## Settings

- `todoNumbers.autoRenumberOnSave`: renumber after saving a document.
- `todoNumbers.todoPattern`: regex used to find numbered TODO comments.
- `todoNumbers.insertPlaceholder`: placeholder text for inserted TODOs.
- `todoNumbers.excludeFiles`: glob patterns for files Todo Numbers should ignore.

Example exclude configuration:

```json
{
  "todoNumbers.excludeFiles": [
    "**/data-dumps/**",
    "**/*.dump",
    "**/vendor/**"
  ]
}
```

The CLI also reads `todoNumbers.todoPattern` and `todoNumbers.excludeFiles` from `.vscode/settings.json`.

## License

MIT

Project docs:

- `docs/AGENTIC_P1_IMPLEMENTATION.md`
- `docs/DESIGN.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/VERIFICATION.md`
- `docs/MARKETPLACE_PUBLISHING.md`
