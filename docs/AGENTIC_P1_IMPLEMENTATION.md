# P1 Agentic Implementation

This document explains how the P1 agent-native TODO workflow is implemented.

## What Changed

The extension now has one shared agent workflow used by both VS Code commands and the terminal CLI:

- `todo-numbers handoff`
- `todo-numbers handoff --prompt-only`
- `todo-numbers handoff --include-diff`
- `todo-numbers handoff --apply-renumber`
- `todo-numbers agent-skill install`
- `todo-numbers agent-skill verify`
- VS Code command `Todo Numbers: Create Agent Handoff`
- VS Code command `Todo Numbers: Install Agent Skill`

The implementation intentionally does not install or mutate Claude Code, Codex, or other agent configuration during Marketplace installation. Agent integration happens only after an explicit command or first-run confirmation.

## Core Modules

`src/core/workspaceTodos.ts` is the shared workspace scanner and fixer. It handles:

- recursive workspace scanning
- `.vscode/settings.json` support for `todoNumbers.todoPattern`
- `.vscode/settings.json` support for `todoNumbers.excludeFiles`
- symlink skipping so scans and fixes do not traverse outside the requested root
- structured TODO inventory output
- deterministic renumber edits
- duplicate-number and stale-number conflict reporting

`src/core/agentHandoff.ts` is the agent handoff layer. It handles:

- building takeover prompts
- creating `.todo-verbose/handoffs/<timestamp>/`
- writing `HANDOFF.md`
- writing `prompt.md`
- writing `todos.json`
- optionally writing `diff-summary.md`
- generating `.todo-verbose/prompt-template.md`
- generating adapter docs for Claude Code, Codex, and generic CLI agents
- installing and verifying a Claude Code-compatible `SKILL.md`

`src/cli.ts` is now mostly command parsing and output formatting. It delegates scanning, fixing, handoff generation, and skill install/verify to the shared core modules.

`src/commands/agentCommands.ts` wires the same core handoff behavior into VS Code commands and returns JSON-compatible objects for programmatic callers.

## Handoff Pack Layout

Running:

```sh
todo-numbers handoff . --include-diff --json
```

creates a local, gitignored handoff pack:

```text
.todo-verbose/
  prompt-template.md
  agent-adapters/
    claude-code/SKILL.md
    codex/SKILL.md
    generic-cli.md
  handoffs/
    20260102-030405/
      HANDOFF.md
      prompt.md
      todos.json
      diff-summary.md
```

`.todo-verbose/` is ignored in the repository `.gitignore`, and generated workspace handoff packs also ensure the target workspace ignores it.

## Prompt-Only Mode

Running:

```sh
todo-numbers handoff . --prompt-only
```

prints a ready-to-use takeover prompt and writes no files. This is meant for an agent that wants context immediately without creating a handoff pack.

## Include-Diff Mode

Running:

```sh
todo-numbers handoff . --include-diff --json
```

adds Git metadata when available:

- current branch
- current commit
- dirty file list
- `git diff --stat` summary

If the root is not a Git repository, the JSON response marks diff metadata as unavailable instead of failing the whole handoff.

## Apply-Renumber Mode

Running:

```sh
todo-numbers handoff . --apply-renumber --include-diff --json
```

first applies deterministic number-only TODO renumbering, then scans again and generates the handoff pack from the clean state.

## Agent Skill Installation

Running:

```sh
todo-numbers agent-skill install . --target claude-code --json
todo-numbers agent-skill verify . --target claude-code --json
```

installs and verifies a generated `todo-numbers` skill document. The default install root is target-specific, but tests and users can override it with:

```sh
todo-numbers agent-skill install . --install-dir /tmp/todo-number-skills --json
```

The generated skill instructs agents to use:

- `todo-numbers scan . --json`
- `todo-numbers check . --json`
- `todo-numbers handoff . --include-diff --json`
- `todo-numbers handoff . --apply-renumber --include-diff --json`

## VS Code Integration

`Todo Numbers: Create Agent Handoff` calls the same core handoff code and returns a JSON-compatible result object when invoked through `vscode.commands.executeCommand`.

`Todo Numbers: Install Agent Skill` installs the generated agent skill after explicit user confirmation. Tests pass `confirm: false` to exercise the command without UI prompts.

A first-run prompt is present for production extension mode. It offers optional agent integration setup, but no external agent configuration is touched unless the user confirms.

## Test Coverage

The P1 agentic work was implemented test-first. Coverage includes:

- handoff prompt-only mode writes no files
- handoff pack generation writes `HANDOFF.md`, `prompt.md`, `todos.json`, `diff-summary.md`, prompt template, and adapter templates
- `--apply-renumber` fixes numbering before generating the pack
- duplicate and stale TODO conflicts are reported in structured scan output
- CLI `handoff`, `agent-skill install`, and `agent-skill verify`
- VS Code command `Todo Numbers: Create Agent Handoff`
- VS Code command `Todo Numbers: Install Agent Skill`
- remote workspace excludes
- symlink-safe CLI scanning

The full test suite runs inside an isolated VS Code Electron instance using a temporary workspace, user-data directory, and extensions directory.
