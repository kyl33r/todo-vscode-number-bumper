# TODO VS Code Number Bumper

A VS Code extension for keeping numbered TODO comments sequential in the current file.

## Features

- Renumber numbered TODO comments in the active file.
- Insert a new numbered TODO after the nearest preceding TODO.
- Optionally renumber TODOs after saving a file.
- Preserve pinned TODOs such as `TODO #99 [pin]: External tracker`.
- Exclude generated, vendor, or data dump files with glob patterns.

## Supported Formats

```ts
TODO #1: text
// TODO #1: text
# TODO #1: text
<!-- TODO #1: text -->
```

## Commands

Commands:

- `Todo Numbers: Renumber Current File`
- `Todo Numbers: Insert TODO After Current`
- `Todo Numbers: Toggle Auto Renumber On Save`

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

Project docs:

- `DESIGN.md`
- `IMPLEMENTATION_PLAN.md`
- `VERIFICATION.md`
- `MARKETPLACE_PUBLISHING.md`
