import * as fs from "node:fs";
import * as path from "node:path";
import { buildRenumberEdits, type RenumberEdit } from "./renumberEngine";
import { isPathExcluded, normalizePath } from "./pathFilters";
import { parseTodos, type TodoItem } from "../parser/todoParser";

export type WorkspaceTodoOptions = {
  rootPath: string;
  todoPattern: string | RegExp;
  excludeFiles: readonly string[];
};

export type WorkspaceSettings = {
  todoPattern?: string;
  excludeFiles: string[];
};

export type ScannedTodo = {
  line: number;
  column: number;
  number: number;
  text: string;
  pinned: boolean;
};

export type ScannedEdit = {
  line: number;
  column: number;
  oldNumber: number;
  newNumber: number;
};

export type ScannedFile = {
  file: string;
  todos: ScannedTodo[];
  suggestedEdits: ScannedEdit[];
};

export type TodoConflict = {
  type: "duplicate-number" | "stale-number";
  file: string;
  message: string;
  number?: number;
  lines: number[];
  suggestedEdit?: ScannedEdit;
};

export type ScanResult = {
  root: string;
  filesScanned: number;
  filesWithTodos: number;
  todosFound: number;
  filesNeedingRenumber: number;
  editsNeeded: number;
  conflictsFound: number;
  conflicts: TodoConflict[];
  files: ScannedFile[];
};

export type FixResult = ScanResult & {
  filesChanged: number;
  editsApplied: number;
};

const TEXT_SAMPLE_BYTES = 4096;

export function scanWorkspace(options: WorkspaceTodoOptions): ScanResult {
  const rootPath = path.resolve(options.rootPath);
  const files: ScannedFile[] = [];
  const filePaths = collectFilePaths(rootPath, options.excludeFiles);

  for (const filePath of filePaths) {
    const content = readTextFile(filePath);
    if (content === undefined) {
      continue;
    }

    const todos = parseTodos(content, options.todoPattern);
    if (todos.length === 0) {
      continue;
    }

    const edits = buildRenumberEdits(todos);
    files.push({
      file: normalizePath(path.relative(rootPath, filePath)),
      todos: todos.map(toScannedTodo),
      suggestedEdits: edits.map(toScannedEdit)
    });
  }

  const conflicts = detectTodoConflicts(files);
  const filesNeedingRenumber = files.filter((file) => file.suggestedEdits.length > 0).length;
  const editsNeeded = files.reduce((count, file) => count + file.suggestedEdits.length, 0);

  return {
    root: normalizePath(rootPath),
    filesScanned: filePaths.length,
    filesWithTodos: files.length,
    todosFound: files.reduce((count, file) => count + file.todos.length, 0),
    filesNeedingRenumber,
    editsNeeded,
    conflictsFound: conflicts.length,
    conflicts,
    files
  };
}

export function applyFixes(options: WorkspaceTodoOptions, scanResult = scanWorkspace(options)): FixResult {
  const rootPath = path.resolve(options.rootPath);
  let filesChanged = 0;
  let editsApplied = 0;

  for (const file of scanResult.files) {
    if (file.suggestedEdits.length === 0) {
      continue;
    }

    const absolutePath = path.join(rootPath, file.file);
    const content = fs.readFileSync(absolutePath, "utf8");
    const todos = parseTodos(content, options.todoPattern);
    const edits = buildRenumberEdits(todos);
    fs.writeFileSync(absolutePath, applyRenumberEditsToContent(content, edits), "utf8");
    filesChanged += 1;
    editsApplied += edits.length;
  }

  return {
    ...scanResult,
    filesChanged,
    editsApplied
  };
}

export function detectTodoConflicts(files: readonly ScannedFile[]): TodoConflict[] {
  const conflicts: TodoConflict[] = [];

  for (const file of files) {
    const todosByNumber = new Map<number, ScannedTodo[]>();

    for (const todo of file.todos) {
      todosByNumber.set(todo.number, [...(todosByNumber.get(todo.number) ?? []), todo]);
    }

    for (const [number, todos] of todosByNumber) {
      if (todos.length <= 1) {
        continue;
      }

      conflicts.push({
        type: "duplicate-number",
        file: file.file,
        number,
        lines: todos.map((todo) => todo.line),
        message: `${file.file}: TODO #${number} appears on multiple lines: ${todos.map((todo) => todo.line).join(", ")}.`
      });
    }

    for (const edit of file.suggestedEdits) {
      conflicts.push({
        type: "stale-number",
        file: file.file,
        number: edit.oldNumber,
        lines: [edit.line],
        suggestedEdit: edit,
        message: `${file.file}:${edit.line} has stale TODO #${edit.oldNumber}; expected #${edit.newNumber}.`
      });
    }
  }

  return conflicts;
}

export function collectFilePaths(rootPath: string, excludeFiles: readonly string[]): string[] {
  const resolvedRoot = path.resolve(rootPath);
  const filePaths: string[] = [];
  const stack = [resolvedRoot];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath || isPathExcluded(currentPath, excludeFiles, [resolvedRoot])) {
      continue;
    }

    const stat = fs.lstatSync(currentPath);
    if (stat.isSymbolicLink()) {
      continue;
    }

    if (stat.isDirectory()) {
      const children = fs
        .readdirSync(currentPath, { withFileTypes: true })
        .map((entry) => path.join(currentPath, entry.name))
        .sort()
        .reverse();

      stack.push(...children);
      continue;
    }

    if (stat.isFile()) {
      filePaths.push(currentPath);
    }
  }

  return filePaths.sort();
}

export function readWorkspaceSettings(rootPath: string): WorkspaceSettings {
  const settingsPath = path.join(rootPath, ".vscode", "settings.json");
  if (!fs.existsSync(settingsPath)) {
    return { excludeFiles: [] };
  }

  try {
    const rawSettings = fs.readFileSync(settingsPath, "utf8");
    const settings = JSON.parse(stripJsonComments(rawSettings)) as Record<string, unknown>;
    return {
      todoPattern: typeof settings["todoNumbers.todoPattern"] === "string"
        ? settings["todoNumbers.todoPattern"]
        : undefined,
      excludeFiles: Array.isArray(settings["todoNumbers.excludeFiles"])
        ? settings["todoNumbers.excludeFiles"].filter((value): value is string => typeof value === "string")
        : []
    };
  } catch {
    return { excludeFiles: [] };
  }
}

export function applyRenumberEditsToContent(content: string, edits: readonly RenumberEdit[]): string {
  const lineStarts = buildLineStarts(content);
  let updatedContent = content;

  for (const edit of [...edits].sort((left, right) => {
    return right.line - left.line || right.start - left.start;
  })) {
    const startOffset = lineStarts[edit.line] + edit.start;
    const endOffset = lineStarts[edit.line] + edit.end;
    updatedContent = `${updatedContent.slice(0, startOffset)}${edit.newNumber}${updatedContent.slice(endOffset)}`;
  }

  return updatedContent;
}

function readTextFile(filePath: string): string | undefined {
  const fileHandle = fs.openSync(filePath, "r");
  try {
    const sample = Buffer.alloc(TEXT_SAMPLE_BYTES);
    const bytesRead = fs.readSync(fileHandle, sample, 0, TEXT_SAMPLE_BYTES, 0);
    if (sample.subarray(0, bytesRead).includes(0)) {
      return undefined;
    }
  } finally {
    fs.closeSync(fileHandle);
  }

  return fs.readFileSync(filePath, "utf8");
}

function toScannedTodo(todo: TodoItem): ScannedTodo {
  return {
    line: todo.line + 1,
    column: todo.numberStart + 1,
    number: todo.number,
    text: todo.text,
    pinned: todo.pinned
  };
}

function toScannedEdit(edit: RenumberEdit): ScannedEdit {
  return {
    line: edit.line + 1,
    column: edit.start + 1,
    oldNumber: edit.oldNumber,
    newNumber: edit.newNumber
  };
}

function buildLineStarts(text: string): number[] {
  const starts = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }

  return starts;
}

function stripJsonComments(value: string): string {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const nextChar = value[index + 1];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && nextChar === "/") {
      while (index < value.length && value[index] !== "\n") {
        index += 1;
      }
      output += "\n";
      continue;
    }

    if (char === "/" && nextChar === "*") {
      index += 2;
      while (index < value.length && !(value[index] === "*" && value[index + 1] === "/")) {
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
}
