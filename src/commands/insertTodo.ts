import * as vscode from "vscode";
import { buildRenumberEditsAfter } from "../core/renumberEngine";
import { getInsertPlaceholder, getTodoPattern, isDocumentExcluded } from "../config/settings";
import { applyRenumberEdits } from "./renumberCurrentFile";
import { parseTodos, type TodoItem } from "../parser/todoParser";

type TodoLineStyle = {
  indent: string;
  prefix: string;
  suffix: string;
};

type InsertionPlan = {
  position: vscode.Position;
  text: string;
  insertedLine: number;
  insertedNumber: number;
  placeholderStart: number;
  placeholderEnd: number;
};

type BuiltTodoLine = {
  text: string;
  placeholderStart: number;
  placeholderEnd: number;
};

export async function insertTodoAfterCurrent(): Promise<void> {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    void vscode.window.showInformationMessage("Todo Numbers: no active editor.");
    return;
  }

  const document = editor.document;
  if (isDocumentExcluded(document)) {
    void vscode.window.showInformationMessage("Todo Numbers: this file is excluded by todoNumbers.excludeFiles.");
    return;
  }

  const placeholder = getInsertPlaceholder();
  const todos = parseTodos(document.getText(), getTodoPattern());
  const insertionPlan = buildInsertionPlan(document, todos, editor.selection.active.line, placeholder);

  const didInsert = await editor.edit((editBuilder) => {
    editBuilder.insert(insertionPlan.position, insertionPlan.text);
  });

  if (!didInsert) {
    void vscode.window.showWarningMessage("Todo Numbers: could not insert TODO.");
    return;
  }

  const updatedTodos = parseTodos(document.getText(), getTodoPattern());
  const edits = buildRenumberEditsAfter(updatedTodos, insertionPlan.insertedLine, insertionPlan.insertedNumber + 1);
  await applyRenumberEdits(document, edits);

  const selectionStart = new vscode.Position(insertionPlan.insertedLine, insertionPlan.placeholderStart);
  const selectionEnd = new vscode.Position(insertionPlan.insertedLine, insertionPlan.placeholderEnd);
  editor.selection = new vscode.Selection(selectionStart, selectionEnd);
  editor.revealRange(new vscode.Range(selectionStart, selectionEnd));
}

export function buildTodoLine(lineText: string, number: number, placeholder: string): string {
  return buildTodoLineWithRange(lineText, number, placeholder).text;
}

function buildTodoLineWithRange(lineText: string, number: number, placeholder: string): BuiltTodoLine {
  const style = inferTodoLineStyle(lineText);
  const beforePlaceholder = `${style.indent}${style.prefix}TODO #${number}: `;
  return {
    text: `${beforePlaceholder}${placeholder}${style.suffix}`,
    placeholderStart: beforePlaceholder.length,
    placeholderEnd: beforePlaceholder.length + placeholder.length
  };
}

function buildDefaultTodoLineWithRange(lineText: string, number: number, placeholder: string): BuiltTodoLine {
  const beforePlaceholder = `${getIndent(lineText)}// TODO #${number}: `;
  return {
    text: `${beforePlaceholder}${placeholder}`,
    placeholderStart: beforePlaceholder.length,
    placeholderEnd: beforePlaceholder.length + placeholder.length
  };
}

function buildInsertionPlan(
  document: vscode.TextDocument,
  todos: readonly TodoItem[],
  cursorLine: number,
  placeholder: string
): InsertionPlan {
  const nearestTodo = findNearestTodoAtOrBefore(todos, cursorLine);
  const insertAfterLine = nearestTodo?.line ?? cursorLine;
  const lineText = nearestTodo ? document.lineAt(nearestTodo.line).text : document.lineAt(cursorLine).text;
  const insertedNumber = countUnpinnedTodosAtOrBefore(todos, insertAfterLine) + 1;
  const todoLine = nearestTodo
    ? buildTodoLineWithRange(lineText, insertedNumber, placeholder)
    : buildDefaultTodoLineWithRange(lineText, insertedNumber, placeholder);
  const eol = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
  const isLastLine = insertAfterLine >= document.lineCount - 1;
  const position = isLastLine
    ? document.lineAt(insertAfterLine).range.end
    : new vscode.Position(insertAfterLine + 1, 0);
  const text = isLastLine ? `${eol}${todoLine.text}` : `${todoLine.text}${eol}`;

  return {
    position,
    text,
    insertedLine: insertAfterLine + 1,
    insertedNumber,
    placeholderStart: todoLine.placeholderStart,
    placeholderEnd: todoLine.placeholderEnd
  };
}

function findNearestTodoAtOrBefore(todos: readonly TodoItem[], cursorLine: number): TodoItem | undefined {
  return [...todos]
    .filter((todo) => todo.line <= cursorLine)
    .sort((left, right) => right.line - left.line || right.numberStart - left.numberStart)[0];
}

function countUnpinnedTodosAtOrBefore(todos: readonly TodoItem[], line: number): number {
  return todos.filter((todo) => !todo.pinned && todo.line <= line).length;
}

function inferTodoLineStyle(lineText: string): TodoLineStyle {
  const indent = getIndent(lineText);
  const trimmed = lineText.slice(indent.length);

  if (trimmed.startsWith("<!--")) {
    return { indent, prefix: "<!-- ", suffix: " -->" };
  }

  if (trimmed.startsWith("//")) {
    return { indent, prefix: "// ", suffix: "" };
  }

  if (trimmed.startsWith("#")) {
    return { indent, prefix: "# ", suffix: "" };
  }

  if (trimmed.startsWith("TODO")) {
    return { indent, prefix: "", suffix: "" };
  }

  return { indent, prefix: "// ", suffix: "" };
}

function getIndent(lineText: string): string {
  return lineText.match(/^\s*/)?.[0] ?? "";
}
