# Changelog

## 0.1.0

- Add current-file TODO renumbering.
- Add TODO insertion after the nearest preceding TODO.
- Add optional auto-renumber on save.
- Add pinned TODO support with `[pin]`.
- Add `todoNumbers.excludeFiles` for generated files, vendor paths, and data dumps that should be ignored.
- Add `todo-numbers scan`, `todo-numbers check`, and `todo-numbers fix` CLI commands for terminals, CI, and coding agents.
- Add `todo-numbers handoff` with prompt-only, Git diff, and apply-renumber modes for agent handoffs.
- Add explicit `todo-numbers agent-skill install` and `verify` commands for Claude Code-compatible skill docs.
- Add VS Code commands for creating agent handoffs and installing agent skills.
- Add generated `.todo-verbose/` prompt templates and adapter docs for Claude Code, Codex, and generic CLI agents.
- Add duplicate and stale TODO number conflict reporting for parallel-agent merge cleanup.
- Replace placeholder package publisher metadata with `kyl33r` and apply the MIT license.
- Add parser, renumber engine, and VS Code command tests.
- Fix extension-host test runner so it uses `@vscode/test-electron` resolution instead of the `code` CLI wrapper.
- Fix custom anchored TODO regex validation.
- Fix inserted placeholder selection for placeholder text such as `TODO`.
- Fix remote workspace excludes and avoid following symlinks during CLI workspace scans.
