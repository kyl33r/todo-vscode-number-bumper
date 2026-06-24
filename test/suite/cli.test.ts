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
