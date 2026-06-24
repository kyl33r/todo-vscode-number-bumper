# Implementation Plan: Numbered TODO Tracker

This plan turns the design in `DESIGN.md` into a concrete VS Code extension implementation.

## Assumptions and Filled Gaps

- The first implementation is a TypeScript VS Code extension.
- Scope is the active text document only. Workspace-wide numbering is explicitly out of scope.
- TODO numbers are sequential within one file, ordered from top to bottom.
- Pinned TODOs keep their existing number and do not consume a sequential number.
- Renumbering edits replace only the numeric range after `TODO #`.
- Auto-renumber runs after a save event and uses a guard to avoid recursive save/edit loops.
- Insert TODO uses the current line's comment style when possible and falls back to `//`.
- Extension settings live under the `todoNumbers` namespace.

## Project Scaffold

Create the extension structure:

```txt
package.json
tsconfig.json
.vscodeignore
src/
  extension.ts
  parser/
    todoParser.ts
  core/
    renumberEngine.ts
  commands/
    renumberCurrentFile.ts
    insertTodo.ts
  config/
    settings.ts
test/
  suite/
    parser.test.ts
    renumberEngine.test.ts
```

Use standard VS Code extension scripts:

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "test": "vscode-test",
    "package": "vsce package"
  }
}
```

Initial dev dependencies:

```txt
@types/mocha
@types/node
@types/vscode
@vscode/test-electron
@vscode/vsce
mocha
typescript
```

## Extension Manifest

Add these commands to `package.json`:

| Command ID | Title |
| --- | --- |
| `todoNumbers.renumberCurrentFile` | `Todo Numbers: Renumber Current File` |
| `todoNumbers.insertTodoAfterCurrent` | `Todo Numbers: Insert TODO After Current` |
| `todoNumbers.toggleAutoRenumberOnSave` | `Todo Numbers: Toggle Auto Renumber On Save` |

Add activation events:

```json
[
  "onCommand:todoNumbers.renumberCurrentFile",
  "onCommand:todoNumbers.insertTodoAfterCurrent",
  "onCommand:todoNumbers.toggleAutoRenumberOnSave",
  "onStartupFinished"
]
```

`onStartupFinished` is needed for the save watcher. If startup cost becomes measurable, defer watcher registration until the first configuration read or command execution.

Add these settings:

| Setting | Type | Default | Purpose |
| --- | --- | --- | --- |
| `todoNumbers.autoRenumberOnSave` | boolean | `false` | Enables renumbering when a document is saved. |
| `todoNumbers.todoPattern` | string | `TODO\\s+#(\\d+)(\\s+\\[pin\\])?:\\s*(.*?)\\s*(?:-->)?$` | Allows advanced users to customize the TODO match pattern. |
| `todoNumbers.insertPlaceholder` | string | `New TODO` | Text used by the insert command. |
| `todoNumbers.excludeFiles` | string array | `[]` | Glob patterns for files the extension should ignore. |

The original design includes `todoNumbers.scope`; omit it from MVP because only file scope is supported. Add it later when workspace scope exists.

If `todoNumbers.todoPattern` is customized, group 1 must capture the numeric TODO value, group 2 must capture the optional pin marker, and group 3 should capture the TODO text. Invalid patterns should fall back to the default pattern and show a warning once per session.

## Data Model

Define parser output like this:

```ts
export type TodoItem = {
  line: number;
  numberStart: number;
  numberEnd: number;
  fullMatchStart: number;
  fullMatchEnd: number;
  number: number;
  text: string;
  pinned: boolean;
};
```

`numberStart` and `numberEnd` are required so edits can replace only the digits.

## Parser

Implement `parseTodos(documentText: string): TodoItem[]`.

Default regex:

```ts
/TODO\s+#(\d+)(\s+\[pin\])?:\s*(.*?)\s*(?:-->)?$/gm
```

Parser requirements:

- Match `TODO #1: text` anywhere on a line.
- Support line comments, hash comments, and HTML comments because the TODO token itself is format-independent.
- Capture the number range precisely.
- Treat `[pin]` as pinned only when it appears between the number and colon.
- Strip the closing `-->` from captured HTML TODO text.
- Ignore malformed TODOs such as `TODO #: text`, `TODO #abc: text`, and `TODO #1 text`.
- Return items sorted by line and column.

Compute line and character positions from the regex match index by precomputing line start offsets. This avoids rescanning the full document for each TODO.

## Renumber Engine

Implement `buildRenumberEdits(todos: TodoItem[]): RenumberEdit[]`.

```ts
export type RenumberEdit = {
  line: number;
  start: number;
  end: number;
  oldNumber: number;
  newNumber: number;
};
```

Algorithm:

1. Set `nextNumber = 1`.
2. Iterate TODOs in document order.
3. If a TODO is pinned, leave it unchanged and do not increment `nextNumber`.
4. If an unpinned TODO number differs from `nextNumber`, emit an edit.
5. Increment `nextNumber` after each unpinned TODO.

Example with pin:

```txt
TODO #1: First
TODO #99 [pin]: External issue
TODO #5: Third
```

Renumbers to:

```txt
TODO #1: First
TODO #99 [pin]: External issue
TODO #2: Third
```

## Renumber Command

`renumberCurrentFile` should:

1. Read `vscode.window.activeTextEditor`.
2. Exit with an informational message if no editor is active.
3. Parse the current document.
4. Build renumber edits.
5. If no edits are needed, optionally show `TODO numbers already sequential`.
6. Apply a single `WorkspaceEdit`.

Use `vscode.Range` for each numeric replacement:

```ts
new vscode.Range(line, start, line, end)
```

Do not rewrite complete lines.

## Auto-Renumber On Save

Register `vscode.workspace.onDidSaveTextDocument`.

Behavior:

- Run only when `todoNumbers.autoRenumberOnSave` is true.
- Run only for the saved document, not necessarily the active editor.
- Use a module-level `Set<string>` of document URIs currently being auto-renumbered.
- Apply edits without triggering another save automatically. Let VS Code mark the file dirty after edits.

This avoids hidden writes and recursive save loops.

## Toggle Auto-Renumber Command

`toggleAutoRenumberOnSave` should:

1. Read the current workspace value.
2. Write the opposite value using `ConfigurationTarget.Workspace`.
3. Show the new state in a short information message.

Use workspace scope because this behavior is project-specific.

## Insert TODO Command

`insertTodoAfterCurrent` should:

1. Read the active editor and cursor line.
2. Parse TODOs in the document.
3. Find the nearest TODO at or before the cursor line.
4. Insert a new TODO line immediately after that TODO.
5. Infer indentation and comment prefix from the nearest TODO line.
6. Assign the inserted TODO the next unpinned sequence number for that insertion position.
7. Renumber every following unpinned TODO in the file.
8. Place the cursor over the inserted placeholder text.

Comment prefix inference:

| Existing line shape | Inserted shape |
| --- | --- |
| `// TODO #1: Text` | `// TODO #2: New TODO` |
| `# TODO #1: Text` | `# TODO #2: New TODO` |
| `<!-- TODO #1: Text -->` | `<!-- TODO #2: New TODO -->` |
| `TODO #1: Text` | `TODO #2: New TODO` |

If there is no existing TODO before the cursor, insert below the current line using the current line indentation and `// TODO #1: New TODO`.

Use `TextEditor.edit` for the insertion, then reparse the document and apply renumber edits in a second edit. That keeps the implementation straightforward and avoids trying to precompute shifted ranges after inserting a line.

## Tests

Add focused tests before broad integration tests.

Parser tests:

- Matches bare TODOs.
- Matches `//`, `#`, and HTML comment lines.
- Captures line, number range, number, text, and pinned state.
- Ignores malformed TODOs.
- Handles multiple TODOs in one document.

Renumber engine tests:

- No edits when already sequential.
- Emits edits for gaps.
- Emits edits for duplicate numbers.
- Skips pinned TODOs.
- Pinned TODOs do not consume sequence numbers.

Command-level tests:

- Renumber command applies only digit replacements.
- Insert command inserts after the nearest preceding TODO.
- Insert command shifts following unpinned TODOs.
- Auto-renumber respects the setting.

## Implementation Order

1. Scaffold the VS Code extension project and TypeScript config.
2. Add command and configuration contributions to `package.json`.
3. Implement `settings.ts`.
4. Implement `todoParser.ts` with unit tests.
5. Implement `renumberEngine.ts` with unit tests.
6. Implement `renumberCurrentFile.ts`.
7. Wire activation and command registration in `extension.ts`.
8. Implement save watcher and recursion guard.
9. Implement toggle command.
10. Implement insert command and cursor placement.
11. Add command-level tests.
12. Run compile and tests.
13. Package a local `.vsix` once the MVP passes.

## Acceptance Criteria

- `Todo Numbers: Renumber Current File` renumbers active-file TODOs from top to bottom.
- Existing text, spacing, comments, and line endings are preserved except changed digits.
- Pinned TODOs keep their original numbers.
- Auto-renumber runs only when enabled.
- Auto-renumber does not modify files while the user is typing.
- Excluded files are ignored by command-driven renumbering, insertion, and auto-renumber on save.
- Insert command creates a TODO in the expected style and renumbers following TODOs.
- Unit tests cover parser and renumbering edge cases.
- `npm run compile` and `npm test` pass.

## Deferred Work

- Sidebar or tree view.
- Workspace-wide numbering.
- Cross-file TODO database.
- Language-specific comment parsers.
- Multi-root workspace behavior.
- Published marketplace release.
