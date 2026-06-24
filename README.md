# TODO VS Code Number Bumper

A VS Code extension for keeping numbered TODO comments sequential in the current file.

## Features

- Renumber numbered TODO comments in the active file.
- Insert a new numbered TODO after the nearest preceding TODO.
- Optionally renumber TODOs after saving a file.
- Preserve pinned TODOs such as `TODO #99 [pin]: External tracker`.
- Exclude generated, vendor, or data dump files with glob patterns.
- Use the `todo-numbers` CLI from terminals, CI jobs, and coding agents.

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

CLI commands:

```sh
todo-numbers scan [root]
todo-numbers check [root]
todo-numbers fix [root]
```

`scan` prints structured JSON by default. `check` exits with code `1` when renumbering is needed. `fix` applies deterministic number-only edits.

From a source checkout, run the CLI as:

```sh
node ./out/src/cli.js scan . --json
```

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

Project docs:

- `DESIGN.md`
- `IMPLEMENTATION_PLAN.md`
- `VERIFICATION.md`
- `MARKETPLACE_PUBLISHING.md`
