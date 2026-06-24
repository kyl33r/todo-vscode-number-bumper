import * as vscode from "vscode";
import { buildRenumberEdits, type RenumberEdit } from "../core/renumberEngine";
import { getTodoPattern, isDocumentExcluded } from "../config/settings";
import { parseTodos } from "../parser/todoParser";

export async function renumberCurrentFile(): Promise<number> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    void vscode.window.showInformationMessage("Todo Numbers: no active editor.");
    return 0;
  }

  return renumberDocument(editor.document, { showNoopMessage: true });
}

export async function renumberDocument(
  document: vscode.TextDocument,
  options: { showNoopMessage?: boolean; showExcludedMessage?: boolean } = {}
): Promise<number> {
  if (isDocumentExcluded(document)) {
    if (options.showExcludedMessage ?? options.showNoopMessage) {
      void vscode.window.showInformationMessage("Todo Numbers: this file is excluded by todoNumbers.excludeFiles.");
    }
    return 0;
  }

  const todos = parseTodos(document.getText(), getTodoPattern());
  const edits = buildRenumberEdits(todos);

  if (edits.length === 0) {
    if (options.showNoopMessage) {
      void vscode.window.showInformationMessage("Todo Numbers: TODO numbers already sequential.");
    }
    return 0;
  }

  await applyRenumberEdits(document, edits);
  return edits.length;
}

export async function applyRenumberEdits(document: vscode.TextDocument, edits: readonly RenumberEdit[]): Promise<boolean> {
  if (edits.length === 0) {
    return true;
  }

  const workspaceEdit = new vscode.WorkspaceEdit();

  for (const edit of edits) {
    workspaceEdit.replace(
      document.uri,
      new vscode.Range(edit.line, edit.start, edit.line, edit.end),
      String(edit.newNumber)
    );
  }

  return vscode.workspace.applyEdit(workspaceEdit);
}
