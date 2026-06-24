import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { executeCli } from "../../src/cli";

suite("cli", () => {
  test("scan emits structured JSON for workspace TODOs", () => {
    const root = createWorkspace({
      "src/app.ts": [
        "export function run() {",
        "  // TODO #1: First",
        "  return true;",
        "}",
        "// TODO #3: Third"
      ].join("\n")
    });

    const result = executeCli(["scan", root]);
    const payload = JSON.parse(result.stdout) as {
      ok: boolean;
      filesWithTodos: number;
      todosFound: number;
      editsNeeded: number;
      files: Array<{ file: string; todos: Array<{ number: number }>; suggestedEdits: Array<{ oldNumber: number; newNumber: number }> }>;
    };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.ok, false);
    assert.equal(payload.filesWithTodos, 1);
    assert.equal(payload.todosFound, 2);
    assert.equal(payload.editsNeeded, 1);
    assert.equal(payload.files[0].file, "src/app.ts");
    assert.deepEqual(payload.files[0].todos.map((todo) => todo.number), [1, 3]);
    assert.deepEqual(payload.files[0].suggestedEdits, [{ line: 5, column: 10, oldNumber: 3, newNumber: 2 }]);
  });

  test("check exits nonzero when renumber edits are needed", () => {
    const root = createWorkspace({
      "src/app.py": [
        "# TODO #1: First",
        "value = 42",
        "# TODO #9: Ninth"
      ].join("\n")
    });

    const result = executeCli(["check", root, "--json"]);
    const payload = JSON.parse(result.stdout) as { ok: boolean; editsNeeded: number };

    assert.equal(result.exitCode, 1);
    assert.equal(payload.ok, false);
    assert.equal(payload.editsNeeded, 1);
  });

  test("fix renumbers files and respects workspace excludes", () => {
    const root = createWorkspace({
      ".vscode/settings.json": JSON.stringify({
        "todoNumbers.excludeFiles": ["**/data-dumps/**"]
      }),
      "src/app.go": [
        "package main",
        "",
        "// TODO #1: First",
        "func main() {}",
        "// TODO #5: Fifth"
      ].join("\n"),
      "data-dumps/raw.dump": [
        "// TODO #1: Dump marker",
        "payload=TODO #9: should stay untouched",
        "// TODO #8: Dump marker"
      ].join("\n")
    });

    const result = executeCli(["fix", root, "--json"]);
    const payload = JSON.parse(result.stdout) as { editsApplied: number; filesChanged: number };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.editsApplied, 1);
    assert.equal(payload.filesChanged, 1);
    assert.equal(
      fs.readFileSync(path.join(root, "src/app.go"), "utf8"),
      [
        "package main",
        "",
        "// TODO #1: First",
        "func main() {}",
        "// TODO #2: Fifth"
      ].join("\n")
    );
    assert.match(fs.readFileSync(path.join(root, "data-dumps/raw.dump"), "utf8"), /TODO #8: Dump marker/);
  });

  test("scan respects anchored comment-only patterns from VS Code workspace settings", () => {
    const root = createWorkspace({
      ".vscode/settings.json": JSON.stringify({
        "todoNumbers.todoPattern": String.raw`^\s*//\s+TODO\s+#(\d+)(\s+\[pin\])?:\s*(.*?)$`
      }),
      "src/app.ts": [
        "const raw = 'TODO #99: data string';",
        "// TODO #1: First",
        "// TODO #4: Fourth"
      ].join("\n")
    });

    const result = executeCli(["scan", root]);
    const payload = JSON.parse(result.stdout) as {
      todosFound: number;
      files: Array<{ todos: Array<{ number: number }>; suggestedEdits: Array<{ oldNumber: number; newNumber: number }> }>;
    };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.todosFound, 2);
    assert.deepEqual(payload.files[0].todos.map((todo) => todo.number), [1, 4]);
    assert.deepEqual(payload.files[0].suggestedEdits, [{ line: 3, column: 10, oldNumber: 4, newNumber: 2 }]);
  });

  test("scan JSON includes conflict helpers for duplicate and stale TODO numbers", () => {
    const root = createWorkspace({
      "src/conflict.ts": [
        "// TODO #1: First",
        "const value = 42;",
        "// TODO #1: Duplicate from parallel work",
        "// TODO #9: Stale number"
      ].join("\n")
    });

    const result = executeCli(["scan", root]);
    const payload = JSON.parse(result.stdout) as {
      conflictsFound: number;
      conflicts: Array<{ type: string; file: string; number?: number }>;
    };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.conflictsFound, 3);
    assert.deepEqual(
      [...new Set(payload.conflicts.map((conflict) => conflict.type))].sort(),
      ["duplicate-number", "stale-number"]
    );
  });

  test("handoff prompt-only prints an agent prompt without writing files", () => {
    const root = createWorkspace({
      "src/app.ts": ["// TODO #1: First", "const value = 42;", "// TODO #3: Third"].join("\n")
    });

    const result = executeCli(["handoff", root, "--prompt-only"]);

    assert.equal(result.exitCode, 1);
    assert.match(result.stdout, /You are taking over a TODO-numbered workspace/);
    assert.match(result.stdout, /src\/app\.ts:3/);
    assert.equal(fs.existsSync(path.join(root, ".todo-verbose")), false);
  });

  test("handoff JSON can apply renumbering and include diff metadata", () => {
    const root = createWorkspace({
      "src/app.ts": ["// TODO #1: First", "const value = 42;", "// TODO #7: Seventh"].join("\n")
    });

    const result = executeCli(["handoff", root, "--apply-renumber", "--include-diff", "--json"]);
    const payload = JSON.parse(result.stdout) as {
      command: string;
      ok: boolean;
      packPath: string;
      fix: { editsApplied: number };
      diff: { available: boolean };
    };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.command, "handoff");
    assert.equal(payload.ok, true);
    assert.equal(payload.fix.editsApplied, 1);
    assert.equal(payload.diff.available, false);
    assert.ok(fs.existsSync(path.join(payload.packPath, "HANDOFF.md")));
    assert.match(fs.readFileSync(path.join(root, "src/app.ts"), "utf8"), /TODO #2: Seventh/);
  });

  test("agent-skill install and verify write a Claude Code-compatible skill", () => {
    const root = createWorkspace({});
    const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-cli-skill-"));

    const install = executeCli(["agent-skill", "install", root, "--install-dir", installRoot, "--json"]);
    const verify = executeCli(["agent-skill", "verify", root, "--install-dir", installRoot, "--json"]);
    const installPayload = JSON.parse(install.stdout) as { ok: boolean; verified: boolean; skillPath: string };
    const verifyPayload = JSON.parse(verify.stdout) as { ok: boolean; skillPath: string };

    assert.equal(install.exitCode, 0);
    assert.equal(installPayload.ok, true);
    assert.equal(installPayload.verified, true);
    assert.equal(verify.exitCode, 0);
    assert.equal(verifyPayload.ok, true);
    assert.match(fs.readFileSync(installPayload.skillPath, "utf8"), /todo-numbers handoff/);
  });

  test("scan skips symlinked files outside the root", function () {
    const outsideRoot = createWorkspace({
      "outside.ts": ["// TODO #1: Outside", "// TODO #9: Outside"].join("\n")
    });
    const root = createWorkspace({});

    try {
      fs.symlinkSync(path.join(outsideRoot, "outside.ts"), path.join(root, "linked.ts"));
    } catch {
      this.skip();
    }

    const result = executeCli(["scan", root]);
    const payload = JSON.parse(result.stdout) as { todosFound: number; files: Array<{ file: string }> };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.todosFound, 0);
    assert.deepEqual(payload.files, []);
  });

  test("scan skips symlinked directories outside the root", function () {
    const outsideRoot = createWorkspace({
      "nested/outside.ts": ["// TODO #1: Outside", "// TODO #9: Outside"].join("\n")
    });
    const root = createWorkspace({});

    try {
      fs.symlinkSync(path.join(outsideRoot, "nested"), path.join(root, "linked-dir"), "dir");
    } catch {
      this.skip();
    }

    const result = executeCli(["scan", root]);
    const payload = JSON.parse(result.stdout) as { todosFound: number; files: Array<{ file: string }> };

    assert.equal(result.exitCode, 0);
    assert.equal(payload.todosFound, 0);
    assert.deepEqual(payload.files, []);
  });
});

function createWorkspace(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-cli-"));

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  }

  return root;
}
