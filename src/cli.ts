#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { buildRenumberEdits, type RenumberEdit } from "./core/renumberEngine";
import { DEFAULT_EXCLUDED_FILE_PATTERNS, isPathExcluded, normalizePath } from "./core/pathFilters";
import { DEFAULT_TODO_PATTERN, parseTodos, type TodoItem } from "./parser/todoParser";

type CliCommand = "scan" | "check" | "fix";

type CliOptions = {
  command: CliCommand;
  rootPath: string;
  todoPattern: string;
  excludeFiles: string[];
  json: boolean;
};

type WorkspaceSettings = {
  todoPattern?: string;
  excludeFiles: string[];
};

type ScannedTodo = {
  line: number;
  column: number;
  number: number;
  text: string;
  pinned: boolean;
};

type ScannedEdit = {
  line: number;
  column: number;
  oldNumber: number;
  newNumber: number;
};

type ScannedFile = {
  file: string;
  todos: ScannedTodo[];
  suggestedEdits: ScannedEdit[];
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type ScanResult = {
  root: string;
  filesScanned: number;
  filesWithTodos: number;
  todosFound: number;
  filesNeedingRenumber: number;
  editsNeeded: number;
  files: ScannedFile[];
};

type FixResult = ScanResult & {
  filesChanged: number;
  editsApplied: number;
};

const TEXT_SAMPLE_BYTES = 4096;

export function executeCli(rawArgs: readonly string[], cwd = process.cwd()): CliResult {
  try {
    const options = parseArgs(rawArgs, cwd);
    const result = runCommand(options);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${message}\n\n${usage()}`
    };
  }
}

function runCommand(options: CliOptions): CliResult {
  const scanResult = scanWorkspace(options);

  if (options.command === "scan") {
    return {
      exitCode: 0,
      stdout: formatScanResult("scan", scanResult, options.json),
      stderr: ""
    };
  }

  if (options.command === "check") {
    const isClean = scanResult.editsNeeded === 0;
    return {
      exitCode: isClean ? 0 : 1,
      stdout: formatScanResult("check", scanResult, options.json),
      stderr: ""
    };
  }

  const fixResult = applyFixes(options, scanResult);
  return {
    exitCode: 0,
    stdout: formatFixResult(fixResult, options.json),
    stderr: ""
  };
}

function scanWorkspace(options: CliOptions): ScanResult {
  const files: ScannedFile[] = [];
  const filePaths = collectFilePaths(options.rootPath, options.excludeFiles);

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
      file: normalizePath(path.relative(options.rootPath, filePath)),
      todos: todos.map(toScannedTodo),
      suggestedEdits: edits.map(toScannedEdit)
    });
  }

  const filesNeedingRenumber = files.filter((file) => file.suggestedEdits.length > 0).length;
  const editsNeeded = files.reduce((count, file) => count + file.suggestedEdits.length, 0);

  return {
    root: normalizePath(options.rootPath),
    filesScanned: filePaths.length,
    filesWithTodos: files.length,
    todosFound: files.reduce((count, file) => count + file.todos.length, 0),
    filesNeedingRenumber,
    editsNeeded,
    files
  };
}

function applyFixes(options: CliOptions, scanResult: ScanResult): FixResult {
  let filesChanged = 0;
  let editsApplied = 0;

  for (const file of scanResult.files) {
    if (file.suggestedEdits.length === 0) {
      continue;
    }

    const absolutePath = path.join(options.rootPath, file.file);
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

function parseArgs(rawArgs: readonly string[], cwd: string): CliOptions {
  const args = [...rawArgs];
  const command = args.shift();
  if (!isCommand(command)) {
    throw new Error("Expected command: scan, check, or fix.");
  }

  let rootPath = cwd;
  let todoPattern: string | undefined;
  const cliExcludeFiles: string[] = [];
  let json = command === "scan";

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) {
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--no-json") {
      json = false;
      continue;
    }

    if (arg === "--pattern") {
      todoPattern = readOptionValue("--pattern", args);
      continue;
    }

    if (arg === "--exclude") {
      cliExcludeFiles.push(...splitPatterns(readOptionValue("--exclude", args)));
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error(usage());
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    rootPath = path.resolve(cwd, arg);
  }

  const workspaceSettings = readWorkspaceSettings(rootPath);
  return {
    command,
    rootPath,
    todoPattern: todoPattern ?? workspaceSettings.todoPattern ?? DEFAULT_TODO_PATTERN,
    excludeFiles: [
      ...DEFAULT_EXCLUDED_FILE_PATTERNS,
      ...workspaceSettings.excludeFiles,
      ...cliExcludeFiles
    ],
    json
  };
}

function collectFilePaths(rootPath: string, excludeFiles: readonly string[]): string[] {
  const filePaths: string[] = [];
  const stack = [rootPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    if (!currentPath || isPathExcluded(currentPath, excludeFiles, [rootPath])) {
      continue;
    }

    const stat = fs.statSync(currentPath);
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

function applyRenumberEditsToContent(content: string, edits: readonly RenumberEdit[]): string {
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

function buildLineStarts(text: string): number[] {
  const starts = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      starts.push(index + 1);
    }
  }

  return starts;
}

function readWorkspaceSettings(rootPath: string): WorkspaceSettings {
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

function formatScanResult(command: "scan" | "check", result: ScanResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify({ command, ok: result.editsNeeded === 0, ...result }, null, 2)}\n`;
  }

  if (result.editsNeeded === 0) {
    return `Todo Numbers: ${result.todosFound} TODO(s) found across ${result.filesWithTodos} file(s); numbering is clean.\n`;
  }

  return `Todo Numbers: ${result.editsNeeded} renumber edit(s) needed across ${result.filesNeedingRenumber} file(s).\n`;
}

function formatFixResult(result: FixResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify({ command: "fix", ok: true, ...result }, null, 2)}\n`;
  }

  return `Todo Numbers: applied ${result.editsApplied} edit(s) across ${result.filesChanged} file(s).\n`;
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

function isCommand(value: string | undefined): value is CliCommand {
  return value === "scan" || value === "check" || value === "fix";
}

function readOptionValue(option: string, args: string[]): string {
  const value = args.shift();
  if (!value) {
    throw new Error(`Missing value for ${option}.`);
  }
  return value;
}

function splitPatterns(value: string): string[] {
  return value.split(",").map((pattern) => pattern.trim()).filter(Boolean);
}

function usage(): string {
  return [
    "Usage: todo-numbers <scan|check|fix> [root] [options]",
    "",
    "Options:",
    "  --json                Print JSON output.",
    "  --no-json             Print a compact human-readable summary.",
    "  --pattern <regex>     Override the TODO regex.",
    "  --exclude <glob>      Add an exclude glob. Can be repeated or comma-separated.",
    "  -h, --help            Show this help text."
  ].join("\n");
}

if (require.main === module) {
  const result = executeCli(process.argv.slice(2));
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exitCode = result.exitCode;
}
