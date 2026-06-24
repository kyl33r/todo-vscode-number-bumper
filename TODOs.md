# TODOs

This file tracks product and implementation work for the TODO VS Code Number Bumper extension.

## DONE

### P0

- Implement current-file TODO renumbering.
- Preserve pinned TODOs with `[pin]`.
- Add insert-after-current TODO command.
- Add optional auto-renumber on save.
- Add file exclusion support with `todoNumbers.excludeFiles`.
- Add tests for Python, Go, and TypeScript source samples with code between TODO comments.
- Add tests proving current-file renumbering does not modify other open files.
- Add Marketplace publishing guide.
- Fix review finding: ensure `npm test` does not pass the `code` CLI wrapper to `@vscode/test-electron`.
- Fix review finding: support valid anchored custom TODO regexes such as `^\\s*//\\s+TODO\\s+#(\\d+)(\\s+\\[pin\\])?:\\s*(.*?)$`.
- Fix review finding: select the inserted placeholder range by construction instead of using `indexOf`, so placeholders like `TODO` do not select the marker.

### P1

- Add local VSIX packaging flow.
- Add local VS Code install verification steps.
- Add production dependency audit step.
- Add package metadata for repository, homepage, and issue tracker.
- Add a CLI entry point that does not require VS Code.
- Add `todo-numbers scan` to output tracked TODOs as JSON.
- Add `todo-numbers check` for CI/agent validation.
- Add `todo-numbers fix` for deterministic renumbering from the terminal.
- Add code-level configurable CLI entrypoint through `todo-numbers.config.json`.
- Add dry-run renumbering that returns a structured edit plan without mutating files.
- Add CLI output as structured JSON for agent callers.
- Add workspace-level TODO scanning while still respecting `todoNumbers.excludeFiles`.

### P2

- Add project design and implementation plan docs.
- Add support and changelog docs.

## NOT DONE

### P0

- Replace placeholder Marketplace publisher `local-dev` with the real publisher ID before public release.
- Decide and apply the public license before Marketplace publishing.

### P1

- Add `todo-numbers handoff` to generate an agent handoff pack.
- Add `todo-numbers handoff --prompt-only` to print a ready-to-use prompt for the current coding agent.
- Add `todo-numbers handoff --include-diff` to include Git branch, commit, dirty files, and diff summary.
- Add `todo-numbers handoff --apply-renumber` to clean numbering before generating the handoff.
- Add VS Code command `Todo Numbers: Create Agent Handoff`.
- Add VS Code command `Todo Numbers: Install Agent Skill` that guides the user through installing companion agent tooling.
- Add a first-run prompt that offers agent integration setup after explicit user confirmation.
- Add Claude Code skill export/install support for the TODO handoff workflow.
- Add adapter templates for other coding agents that can consume CLI tools, MCP servers, or skill-like Markdown instructions.
- Add a generated agent skill that documents `todo-numbers scan`, `todo-numbers check`, `todo-numbers fix`, and `todo-numbers handoff`.
- Add a generated agent prompt template for taking over work from `.todo-verbose/` and handoff packs.
- Add install verification for agent integrations so users can confirm the skill/tool is available to their agent.
- Do not silently install or mutate external agent configuration during VS Code Marketplace installation; require an explicit command or confirmation.
- Add VS Code command/API output as structured JSON for agent callers.
- Add merge/conflict helpers to detect duplicate, stale, or conflicting TODO numbers after parallel agent work.

### P2

- Add `.todo-verbose/` as a gitignored directory for local verbose TODO handoff specs.
- Add `.todo-verbose/index.json` mapping inline TODOs to verbose Markdown specs.
- Add stable TODO IDs, for example `TODO #3 [id:insert-placeholder-selection]: Fix placeholder selection`.
- Add `todo-numbers verbose init` to create `.todo-verbose/`.
- Add `todo-numbers verbose sync` to create missing verbose spec files for tracked TODOs.
- Add orphan detection when a verbose spec no longer has a matching inline TODO.
- Add `todo-numbers handoff --include-verbose` to compile verbose specs into the handoff pack.
- Consider a committed `.todo-specs/` directory for durable long-lived task specs.
- Add optional TODO metadata tags such as `[agent:codex]`, `[issue:123]`, and `[status:blocked]`.
- Add sidebar or tree view.
- Add cross-file TODO database.
- Add language-specific comment parsers.
- Add multi-root workspace behavior.
