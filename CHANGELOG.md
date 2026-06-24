# Changelog

## 0.1.0

- Add current-file TODO renumbering.
- Add TODO insertion after the nearest preceding TODO.
- Add optional auto-renumber on save.
- Add pinned TODO support with `[pin]`.
- Add `todoNumbers.excludeFiles` for generated files, vendor paths, and data dumps that should be ignored.
- Add `todo-numbers scan`, `todo-numbers check`, and `todo-numbers fix` CLI commands for terminals, CI, and coding agents.
- Add parser, renumber engine, and VS Code command tests.
- Fix extension-host test runner so it uses `@vscode/test-electron` resolution instead of the `code` CLI wrapper.
- Fix custom anchored TODO regex validation.
- Fix inserted placeholder selection for placeholder text such as `TODO`.
