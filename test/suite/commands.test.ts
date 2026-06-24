import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

suite("commands", () => {
  teardown(async () => {
    await resetTodoNumbersConfig();
  });

  test("renumber command applies only digit replacements", async () => {
    const editor = await openUntitledEditor("// TODO #1: One\n// TODO #3: Three");

    await vscode.commands.executeCommand("todoNumbers.renumberCurrentFile");

    assert.equal(editor.document.getText(), "// TODO #1: One\n// TODO #2: Three");
  });

  test("renumber command preserves sample code between TODO lines", async () => {
    const editor = await openUntitledEditor(
      [
        "export function example() {",
        "  // TODO #1: Setup API",
        "  const value = 42;",
        "  // TODO #4: Add tests",
        "  return value;",
        "}"
      ].join("\n")
    );

    await vscode.commands.executeCommand("todoNumbers.renumberCurrentFile");

    assert.equal(
      editor.document.getText(),
      [
        "export function example() {",
        "  // TODO #1: Setup API",
        "  const value = 42;",
        "  // TODO #2: Add tests",
        "  return value;",
        "}"
      ].join("\n")
    );
  });

  for (const sample of [
    ["Python", "python.input.py", "python.expected.py"],
    ["Go", "go.input.go", "go.expected.go"],
    ["TypeScript", "typescript.input.ts", "typescript.expected.ts"]
  ] as const) {
    test(`renumber command handles verbose ${sample[0]} code`, async () => {
      const editor = await openUntitledEditor(readLanguageFixture(sample[1]));

      await vscode.commands.executeCommand("todoNumbers.renumberCurrentFile");

      assert.equal(editor.document.getText(), readLanguageFixture(sample[2]));
    });
  }

  test("renumber command only changes the active file", async () => {
    const inactiveDocument = await openWorkspaceFile(
      "inactive-scope.ts",
      ["// TODO #1: One", "const untouched = true;", "// TODO #9: Nine"].join("\n")
    );
    const activeDocument = await openWorkspaceFile(
      "active-scope.ts",
      ["// TODO #1: One", "const changed = true;", "// TODO #3: Three"].join("\n")
    );

    await vscode.commands.executeCommand("todoNumbers.renumberCurrentFile");

    assert.equal(
      activeDocument.getText(),
      ["// TODO #1: One", "const changed = true;", "// TODO #2: Three"].join("\n")
    );
    assert.equal(
      inactiveDocument.getText(),
      ["// TODO #1: One", "const untouched = true;", "// TODO #9: Nine"].join("\n")
    );
  });

  test("insert command inserts after nearest preceding TODO and shifts following TODOs", async () => {
    const editor = await openUntitledEditor("// TODO #1: One\n// TODO #2: Two\n// TODO #3: Three");
    editor.selection = new vscode.Selection(new vscode.Position(1, 0), new vscode.Position(1, 0));

    await vscode.commands.executeCommand("todoNumbers.insertTodoAfterCurrent");

    assert.equal(
      editor.document.getText(),
      "// TODO #1: One\n// TODO #2: Two\n// TODO #3: New TODO\n// TODO #4: Three"
    );
    assert.equal(editor.document.getText(editor.selection), "New TODO");
  });

  test("insert command works when the cursor is on code between TODOs", async () => {
    const editor = await openUntitledEditor(
      [
        "// TODO #1: One",
        "const first = 1;",
        "// TODO #2: Two",
        "const second = 2;",
        "// TODO #3: Three"
      ].join("\n")
    );
    editor.selection = new vscode.Selection(new vscode.Position(3, 0), new vscode.Position(3, 0));

    await vscode.commands.executeCommand("todoNumbers.insertTodoAfterCurrent");

    assert.equal(
      editor.document.getText(),
      [
        "// TODO #1: One",
        "const first = 1;",
        "// TODO #2: Two",
        "// TODO #3: New TODO",
        "const second = 2;",
        "// TODO #4: Three"
      ].join("\n")
    );
    assert.equal(editor.document.getText(editor.selection), "New TODO");
  });

  test("insert command preserves HTML TODO style", async () => {
    const editor = await openUntitledEditor("<!-- TODO #1: One -->\n<!-- TODO #2: Two -->");
    editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));

    await vscode.commands.executeCommand("todoNumbers.insertTodoAfterCurrent");

    assert.equal(
      editor.document.getText(),
      "<!-- TODO #1: One -->\n<!-- TODO #2: New TODO -->\n<!-- TODO #3: Two -->"
    );
  });

  test("excluded files are ignored by renumber, insert, and auto-renumber", async () => {
    const config = vscode.workspace.getConfiguration("todoNumbers");
    await config.update("excludeFiles", ["**/data-dumps/**"], vscode.ConfigurationTarget.Workspace);
    await config.update("autoRenumberOnSave", true, vscode.ConfigurationTarget.Workspace);

    const document = await openWorkspaceFile(
      "data-dumps/raw-export.dump",
      [
        "// TODO #1: First coincidental marker",
        "raw_payload=TODO #9: This belongs to a data dump",
        "// TODO #8: Last coincidental marker"
      ].join("\n")
    );
    const editor = await vscode.window.showTextDocument(document);
    editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0));
    const originalText = document.getText();

    await vscode.commands.executeCommand("todoNumbers.renumberCurrentFile");
    assert.equal(document.getText(), originalText);

    await vscode.commands.executeCommand("todoNumbers.insertTodoAfterCurrent");
    assert.equal(document.getText(), originalText);

    await dirtyDocument(document);
    await document.save();
    await delay(250);

    assert.match(document.getText(), /^\/\/ touched\n/);
    assert.match(document.getText(), /TODO #9: This belongs to a data dump/);
    assert.match(document.getText(), /TODO #8: Last coincidental marker/);
  });

  test("auto-renumber only runs when enabled", async () => {
    const config = vscode.workspace.getConfiguration("todoNumbers");
    const originalWorkspaceValue = config.inspect<boolean>("autoRenumberOnSave")?.workspaceValue;

    try {
      await config.update("autoRenumberOnSave", false, vscode.ConfigurationTarget.Workspace);
      const disabledDocument = await openWorkspaceFile(
        "auto-disabled.ts",
        ["// TODO #1: One", "const disabled = true;", "// TODO #3: Three"].join("\n")
      );
      await dirtyDocument(disabledDocument);
      await disabledDocument.save();
      await delay(250);
      assert.match(disabledDocument.getText(), /TODO #3: Three/);
      assert.match(disabledDocument.getText(), /const disabled = true;/);

      await config.update("autoRenumberOnSave", true, vscode.ConfigurationTarget.Workspace);
      const enabledDocument = await openWorkspaceFile(
        "auto-enabled.ts",
        ["// TODO #1: One", "const enabled = true;", "// TODO #3: Three"].join("\n")
      );
      await dirtyDocument(enabledDocument);
      await enabledDocument.save();
      await waitFor(() => /TODO #2: Three/.test(enabledDocument.getText()));
      assert.match(enabledDocument.getText(), /TODO #2: Three/);
      assert.match(enabledDocument.getText(), /const enabled = true;/);
    } finally {
      await config.update("autoRenumberOnSave", originalWorkspaceValue, vscode.ConfigurationTarget.Workspace);
    }
  });
});

async function openUntitledEditor(content: string): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({ content });
  return vscode.window.showTextDocument(document);
}

async function openWorkspaceFile(filename: string, content: string): Promise<vscode.TextDocument> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, "Expected a workspace folder for command tests.");

  const filePath = path.join(folder.uri.fsPath, filename);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document);
  return document;
}

async function dirtyDocument(document: vscode.TextDocument): Promise<void> {
  const editor = await vscode.window.showTextDocument(document);
  await editor.edit((editBuilder) => {
    editBuilder.insert(new vscode.Position(0, 0), "// touched\n");
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition.");
    }
    await delay(50);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLanguageFixture(filename: string): string {
  return fs.readFileSync(path.resolve(__dirname, "../../../test/fixtures/languages", filename), "utf8");
}

async function resetTodoNumbersConfig(): Promise<void> {
  const config = vscode.workspace.getConfiguration("todoNumbers");
  await config.update("autoRenumberOnSave", undefined, vscode.ConfigurationTarget.Workspace);
  await config.update("excludeFiles", undefined, vscode.ConfigurationTarget.Workspace);
  await config.update("insertPlaceholder", undefined, vscode.ConfigurationTarget.Workspace);
  await config.update("todoPattern", undefined, vscode.ConfigurationTarget.Workspace);
}
