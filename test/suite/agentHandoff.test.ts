import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createAgentHandoff, installAgentSkill, verifyAgentSkill } from "../../src/core/agentHandoff";
import { DEFAULT_EXCLUDED_FILE_PATTERNS } from "../../src/core/pathFilters";
import { DEFAULT_TODO_PATTERN } from "../../src/parser/todoParser";

suite("agentHandoff", () => {
  test("prompt-only returns a takeover prompt without writing a handoff pack", () => {
    const root = createWorkspace({
      "src/app.ts": ["// TODO #1: First", "const value = 42;", "// TODO #3: Third"].join("\n")
    });

    const result = createAgentHandoff({
      rootPath: root,
      todoPattern: DEFAULT_TODO_PATTERN,
      excludeFiles: DEFAULT_EXCLUDED_FILE_PATTERNS,
      promptOnly: true,
      now: new Date("2026-01-02T03:04:05.000Z")
    });

    assert.equal(result.command, "handoff");
    assert.equal(result.ok, false);
    assert.equal(result.packPath, undefined);
    assert.equal(fs.existsSync(path.join(root, ".todo-verbose")), false);
    assert.match(result.prompt, /You are taking over a TODO-numbered workspace/);
    assert.match(result.prompt, /src\/app\.ts:3/);
    assert.match(result.prompt, /TODO #3: Third/);
  });

  test("apply-renumber writes a gitignored handoff pack with prompt, JSON, templates, and diff summary", () => {
    const root = createWorkspace({
      "src/app.py": ["# TODO #1: First", "value = 42", "# TODO #5: Fifth"].join("\n")
    });

    const result = createAgentHandoff({
      rootPath: root,
      todoPattern: DEFAULT_TODO_PATTERN,
      excludeFiles: DEFAULT_EXCLUDED_FILE_PATTERNS,
      applyRenumber: true,
      includeDiff: true,
      now: new Date("2026-01-02T03:04:05.000Z")
    });

    assert.equal(result.ok, true);
    assert.equal(result.fix?.editsApplied, 1);
    assert.equal(result.scan.editsNeeded, 0);
    assert.match(fs.readFileSync(path.join(root, "src/app.py"), "utf8"), /TODO #2: Fifth/);
    assert.match(fs.readFileSync(path.join(root, ".gitignore"), "utf8"), /\.todo-verbose\//);

    assert.equal(result.packPath, path.join(root, ".todo-verbose", "handoffs", "20260102-030405"));
    assert.ok(fs.existsSync(path.join(result.packPath, "HANDOFF.md")));
    assert.ok(fs.existsSync(path.join(result.packPath, "prompt.md")));
    assert.ok(fs.existsSync(path.join(result.packPath, "todos.json")));
    assert.ok(fs.existsSync(path.join(result.packPath, "diff-summary.md")));
    assert.ok(fs.existsSync(path.join(root, ".todo-verbose", "prompt-template.md")));
    assert.ok(fs.existsSync(path.join(root, ".todo-verbose", "agent-adapters", "claude-code", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(root, ".todo-verbose", "agent-adapters", "codex", "SKILL.md")));
    assert.ok(fs.existsSync(path.join(root, ".todo-verbose", "agent-adapters", "generic-cli.md")));
    assert.equal(result.diff?.available, false);
  });

  test("scan results include merge conflict helpers for duplicate and stale TODO numbers", () => {
    const root = createWorkspace({
      "src/conflict.ts": [
        "// TODO #1: First",
        "const value = 42;",
        "// TODO #1: Duplicate from parallel work",
        "// TODO #9: Stale number"
      ].join("\n")
    });

    const result = createAgentHandoff({
      rootPath: root,
      todoPattern: DEFAULT_TODO_PATTERN,
      excludeFiles: DEFAULT_EXCLUDED_FILE_PATTERNS,
      promptOnly: true
    });

    assert.equal(result.scan.conflictsFound > 0, true);
    assert.deepEqual(
      [...new Set(result.scan.conflicts.map((conflict) => conflict.type))].sort(),
      ["duplicate-number", "stale-number"]
    );
  });

  test("installs and verifies a Claude Code-compatible agent skill", () => {
    const root = createWorkspace({});
    const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-skills-"));

    const install = installAgentSkill({
      rootPath: root,
      target: "claude-code",
      installRoot
    });
    const verify = verifyAgentSkill({
      target: "claude-code",
      installRoot
    });

    const skillPath = path.join(installRoot, "todo-numbers", "SKILL.md");
    assert.equal(install.ok, true);
    assert.equal(install.verified, true);
    assert.equal(verify.ok, true);
    assert.equal(verify.skillPath, skillPath);
    assert.match(fs.readFileSync(skillPath, "utf8"), /todo-numbers handoff/);
  });
});

function createWorkspace(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-handoff-"));

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }

  return root;
}
