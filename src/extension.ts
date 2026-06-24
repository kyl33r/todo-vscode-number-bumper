import * as vscode from "vscode";
import { insertTodoAfterCurrent } from "./commands/insertTodo";
import { renumberCurrentFile, renumberDocument } from "./commands/renumberCurrentFile";
import { isAutoRenumberOnSaveEnabled, toggleAutoRenumberOnSave } from "./config/settings";

const autoRenumberingUris = new Set<string>();

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("todoNumbers.renumberCurrentFile", renumberCurrentFile),
    vscode.commands.registerCommand("todoNumbers.insertTodoAfterCurrent", insertTodoAfterCurrent),
    vscode.commands.registerCommand("todoNumbers.toggleAutoRenumberOnSave", toggleAutoRenumberOnSave),
    vscode.workspace.onDidSaveTextDocument(handleSavedDocument)
  );
}

export function deactivate(): void {
  autoRenumberingUris.clear();
}

async function handleSavedDocument(document: vscode.TextDocument): Promise<void> {
  if (!isAutoRenumberOnSaveEnabled()) {
    return;
  }

  const uri = document.uri.toString();
  if (autoRenumberingUris.has(uri)) {
    return;
  }

  autoRenumberingUris.add(uri);
  try {
    await renumberDocument(document);
  } finally {
    autoRenumberingUris.delete(uri);
  }
}
