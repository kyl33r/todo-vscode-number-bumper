import * as path from "node:path";

export const DEFAULT_EXCLUDED_FILE_PATTERNS = [
  "**/.git/**",
  "**/node_modules/**",
  "**/out/**",
  "**/.vscode-test/**",
  "**/*.vsix"
];

export function isPathExcluded(
  filePath: string,
  patterns: readonly string[],
  workspaceRoots: readonly string[] = []
): boolean {
  if (patterns.length === 0) {
    return false;
  }

  const candidates = getPathCandidates(filePath, workspaceRoots);
  return patterns.some((pattern) => candidates.some((candidate) => matchesGlob(candidate, pattern)));
}

export function matchesGlob(candidatePath: string, rawPattern: string): boolean {
  const pattern = normalizePath(rawPattern.trim());
  if (!pattern) {
    return false;
  }

  return globToRegExp(pattern).test(normalizePath(candidatePath));
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function getPathCandidates(filePath: string, workspaceRoots: readonly string[]): string[] {
  const absolutePath = normalizePath(path.resolve(filePath));
  const candidates = new Set<string>([absolutePath, path.posix.basename(absolutePath)]);

  for (const root of workspaceRoots) {
    const relativePath = path.relative(root, filePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      continue;
    }

    candidates.add(normalizePath(relativePath));
  }

  return Array.from(candidates);
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

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
