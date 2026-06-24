import * as vscode from "vscode";
import * as path from "node:path";
import { createTodoRegex, DEFAULT_TODO_PATTERN } from "../parser/todoParser";

const SECTION = "todoNumbers";
let hasWarnedAboutInvalidPattern = false;

export function getTodoPattern(): RegExp {
  const config = vscode.workspace.getConfiguration(SECTION);
  const pattern = config.get<string>("todoPattern", DEFAULT_TODO_PATTERN);

  try {
    const regex = createTodoRegex(pattern);
    if (!patternMatchesContract(regex)) {
      throw new Error("Pattern does not expose the required capture groups.");
    }
    return regex;
  } catch (error) {
    if (!hasWarnedAboutInvalidPattern) {
      hasWarnedAboutInvalidPattern = true;
      void vscode.window.showWarningMessage(
        `Invalid todoNumbers.todoPattern; using the default pattern. ${error instanceof Error ? error.message : ""}`.trim()
      );
    }

    return createTodoRegex(DEFAULT_TODO_PATTERN);
  }
}

export function getInsertPlaceholder(): string {
  const config = vscode.workspace.getConfiguration(SECTION);
  return config.get<string>("insertPlaceholder", "New TODO");
}

export function isAutoRenumberOnSaveEnabled(): boolean {
  const config = vscode.workspace.getConfiguration(SECTION);
  return config.get<boolean>("autoRenumberOnSave", false);
}

export function getExcludedFilePatterns(): string[] {
  const config = vscode.workspace.getConfiguration(SECTION);
  return config
    .get<string[]>("excludeFiles", [])
    .filter((pattern): pattern is string => typeof pattern === "string" && pattern.trim().length > 0);
}

export function isDocumentExcluded(document: vscode.TextDocument): boolean {
  return isUriExcluded(document.uri, getExcludedFilePatterns(), vscode.workspace.workspaceFolders);
}

export function isUriExcluded(
  uri: vscode.Uri,
  patterns: readonly string[],
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): boolean {
  if (patterns.length === 0) {
    return false;
  }

  const candidates = getPathCandidates(uri, workspaceFolders);
  return patterns.some((pattern) => candidates.some((candidate) => matchesGlob(candidate, pattern)));
}

export async function toggleAutoRenumberOnSave(): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  const currentValue = config.get<boolean>("autoRenumberOnSave", false);
  const nextValue = !currentValue;

  await config.update("autoRenumberOnSave", nextValue, vscode.ConfigurationTarget.Workspace);
  void vscode.window.showInformationMessage(
    `Todo Numbers: auto-renumber on save ${nextValue ? "enabled" : "disabled"}.`
  );
}

function patternMatchesContract(regex: RegExp): boolean {
  const samples = [
    "TODO #1 [pin]: Example",
    "// TODO #1 [pin]: Example",
    "  // TODO #1 [pin]: Example",
    "# TODO #1 [pin]: Example",
    "  # TODO #1 [pin]: Example",
    "<!-- TODO #1 [pin]: Example -->"
  ];

  return samples.some((sample) => {
    regex.lastIndex = 0;
    const match = regex.exec(sample);
    regex.lastIndex = 0;

    return Boolean(match?.[1] && /^\d+$/.test(match[1]) && match[2] !== undefined);
  });
}

function getPathCandidates(
  uri: vscode.Uri,
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
): string[] {
  const absolutePath = normalizePath(uri.scheme === "file" ? uri.fsPath : uri.toString());
  const candidates = new Set<string>([absolutePath, path.posix.basename(absolutePath)]);

  if (uri.scheme === "file") {
    for (const folder of workspaceFolders ?? []) {
      if (folder.uri.scheme !== "file") {
        continue;
      }

      const relativePath = normalizePath(path.relative(folder.uri.fsPath, uri.fsPath));
      if (relativePath && !relativePath.startsWith("..")) {
        candidates.add(relativePath);
      }
    }
  }

  return Array.from(candidates);
}

function matchesGlob(candidate: string, rawPattern: string): boolean {
  const pattern = normalizePath(rawPattern.trim());
  if (!pattern) {
    return false;
  }

  return globToRegExp(pattern).test(candidate);
}

function globToRegExp(pattern: string): RegExp {
  let index = 0;
  let source = "^";

  if (pattern.startsWith("**/")) {
    source += "(?:.*/)?";
    index = 3;
  }

  while (index < pattern.length) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === "*" && nextChar === "*") {
      source += ".*";
      index += 2;
      continue;
    }

    if (char === "*") {
      source += "[^/]*";
      index += 1;
      continue;
    }

    if (char === "?") {
      source += "[^/]";
      index += 1;
      continue;
    }

    source += escapeRegExp(char);
    index += 1;
  }

  return new RegExp(`${source}$`);
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
