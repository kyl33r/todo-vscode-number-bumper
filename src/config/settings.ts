import * as vscode from "vscode";
import { createTodoRegex, DEFAULT_TODO_PATTERN } from "../parser/todoParser";
import { isPathExcluded } from "../core/pathFilters";

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
  if (patterns.length === 0 || uri.scheme !== "file") {
    return false;
  }

  const workspaceRoots = (workspaceFolders ?? [])
    .filter((folder) => folder.uri.scheme === "file")
    .map((folder) => folder.uri.fsPath);
  return isPathExcluded(uri.fsPath, patterns, workspaceRoots);
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
