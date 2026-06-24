import * as childProcess from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  applyFixes,
  scanWorkspace,
  type FixResult,
  type ScanResult,
  type WorkspaceTodoOptions
} from "./workspaceTodos";
import { normalizePath } from "./pathFilters";

export type AgentSkillTarget = "claude-code" | "codex" | "generic";

export type GitDiffSummary = {
  available: boolean;
  branch?: string;
  commit?: string;
  dirtyFiles: string[];
  summary?: string;
  error?: string;
};

export type AgentHandoffOptions = WorkspaceTodoOptions & {
  promptOnly?: boolean;
  includeDiff?: boolean;
  applyRenumber?: boolean;
  now?: Date;
};

export type AgentHandoffResult = {
  command: "handoff";
  ok: boolean;
  root: string;
  prompt: string;
  packPath?: string;
  filesWritten: string[];
  scan: ScanResult;
  fix?: Pick<FixResult, "filesChanged" | "editsApplied">;
  diff?: GitDiffSummary;
};

export type AgentSkillInstallOptions = {
  rootPath: string;
  target?: AgentSkillTarget;
  installRoot?: string;
};

export type AgentSkillInstallResult = {
  command: "agent-skill install";
  ok: boolean;
  target: AgentSkillTarget;
  installRoot: string;
  skillPath: string;
  verified: boolean;
  filesWritten: string[];
};

export type AgentSkillVerifyOptions = {
  target?: AgentSkillTarget;
  installRoot?: string;
};

export type AgentSkillVerifyResult = {
  command: "agent-skill verify";
  ok: boolean;
  target: AgentSkillTarget;
  installRoot: string;
  skillPath: string;
  reason?: string;
};

export function createAgentHandoff(options: AgentHandoffOptions): AgentHandoffResult {
  const rootPath = path.resolve(options.rootPath);
  const todoOptions: WorkspaceTodoOptions = {
    rootPath,
    todoPattern: options.todoPattern,
    excludeFiles: options.excludeFiles
  };
  let scan = scanWorkspace(todoOptions);
  let fix: Pick<FixResult, "filesChanged" | "editsApplied"> | undefined;

  if (options.applyRenumber && scan.editsNeeded > 0) {
    const fixResult = applyFixes(todoOptions, scan);
    fix = {
      filesChanged: fixResult.filesChanged,
      editsApplied: fixResult.editsApplied
    };
    scan = scanWorkspace(todoOptions);
  }

  const diff = options.includeDiff ? getGitDiffSummary(rootPath) : undefined;
  const prompt = buildHandoffPrompt(scan, diff);
  const filesWritten: string[] = [];
  const ok = scan.editsNeeded === 0 && scan.conflictsFound === 0;

  if (options.promptOnly) {
    return {
      command: "handoff",
      ok,
      root: normalizePath(rootPath),
      prompt,
      filesWritten,
      scan,
      fix,
      diff
    };
  }

  ensureTodoVerboseGitignore(rootPath, filesWritten);
  writeAgentSupportFiles(rootPath, filesWritten);

  const packPath = uniqueDirectoryPath(
    path.join(rootPath, ".todo-verbose", "handoffs", formatTimestamp(options.now ?? new Date()))
  );
  fs.mkdirSync(packPath, { recursive: true });

  writeFile(path.join(packPath, "HANDOFF.md"), buildHandoffMarkdown(scan, prompt, diff), filesWritten);
  writeFile(path.join(packPath, "prompt.md"), prompt, filesWritten);
  writeFile(path.join(packPath, "todos.json"), `${JSON.stringify(scan, null, 2)}\n`, filesWritten);

  if (diff) {
    writeFile(path.join(packPath, "diff-summary.md"), buildDiffMarkdown(diff), filesWritten);
  }

  return {
    command: "handoff",
    ok,
    root: normalizePath(rootPath),
    prompt,
    packPath,
    filesWritten,
    scan,
    fix,
    diff
  };
}

export function installAgentSkill(options: AgentSkillInstallOptions): AgentSkillInstallResult {
  const rootPath = path.resolve(options.rootPath);
  const target = options.target ?? "claude-code";
  const installRoot = path.resolve(options.installRoot ?? defaultInstallRoot(target));
  const filesWritten: string[] = [];

  writeAgentSupportFiles(rootPath, filesWritten);

  const skillPath = path.join(installRoot, "todo-numbers", "SKILL.md");
  writeFile(skillPath, buildAgentSkillDocument(target), filesWritten);
  const verification = verifyAgentSkill({ target, installRoot });

  return {
    command: "agent-skill install",
    ok: verification.ok,
    target,
    installRoot,
    skillPath,
    verified: verification.ok,
    filesWritten
  };
}

export function verifyAgentSkill(options: AgentSkillVerifyOptions = {}): AgentSkillVerifyResult {
  const target = options.target ?? "claude-code";
  const installRoot = path.resolve(options.installRoot ?? defaultInstallRoot(target));
  const skillPath = path.join(installRoot, "todo-numbers", "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    return {
      command: "agent-skill verify",
      ok: false,
      target,
      installRoot,
      skillPath,
      reason: "Skill file does not exist."
    };
  }

  const content = fs.readFileSync(skillPath, "utf8");
  const hasRequiredCommands = content.includes("todo-numbers scan") && content.includes("todo-numbers handoff");
  return {
    command: "agent-skill verify",
    ok: hasRequiredCommands,
    target,
    installRoot,
    skillPath,
    reason: hasRequiredCommands ? undefined : "Skill file is missing required todo-numbers command instructions."
  };
}

export function writeAgentSupportFiles(rootPath: string, filesWritten: string[] = []): string[] {
  const verboseRoot = path.join(rootPath, ".todo-verbose");
  writeFile(path.join(verboseRoot, "prompt-template.md"), buildPromptTemplate(), filesWritten);
  writeFile(
    path.join(verboseRoot, "agent-adapters", "claude-code", "SKILL.md"),
    buildAgentSkillDocument("claude-code"),
    filesWritten
  );
  writeFile(
    path.join(verboseRoot, "agent-adapters", "codex", "SKILL.md"),
    buildAgentSkillDocument("codex"),
    filesWritten
  );
  writeFile(
    path.join(verboseRoot, "agent-adapters", "generic-cli.md"),
    buildGenericAgentAdapter(),
    filesWritten
  );

  return filesWritten;
}

function buildHandoffPrompt(scan: ScanResult, diff: GitDiffSummary | undefined): string {
  const lines = [
    "You are taking over a TODO-numbered workspace.",
    "",
    "Start by reading the current TODO inventory and any verbose specs under `.todo-verbose/`.",
    "Use `todo-numbers scan . --json` before editing, `todo-numbers check . --json` before handoff, and `todo-numbers handoff . --include-diff --json` when handing work to the next agent.",
    "",
    "Summarize what has been done across all tracked TODOs, call out duplicate or stale TODO numbers, and preserve numbered TODO comments unless the implementation genuinely completes the work.",
    "",
    "## Current TODOs"
  ];

  if (scan.files.length === 0) {
    lines.push("", "- No tracked TODOs found.");
  } else {
    for (const file of scan.files) {
      for (const todo of file.todos) {
        lines.push(`- ${file.file}:${todo.line} TODO #${todo.number}${todo.pinned ? " [pin]" : ""}: ${todo.text}`);
      }
    }
  }

  lines.push("", "## Numbering State");
  lines.push(`- Files scanned: ${scan.filesScanned}`);
  lines.push(`- TODOs found: ${scan.todosFound}`);
  lines.push(`- Renumber edits needed: ${scan.editsNeeded}`);
  lines.push(`- Conflicts found: ${scan.conflictsFound}`);

  if (scan.conflicts.length > 0) {
    lines.push("", "## Conflicts");
    for (const conflict of scan.conflicts) {
      lines.push(`- ${conflict.type}: ${conflict.message}`);
    }
  }

  if (diff) {
    lines.push("", "## Git State");
    lines.push(diff.available ? `- Branch: ${diff.branch ?? "unknown"}` : `- Git diff unavailable: ${diff.error ?? "not a git repository"}`);
    if (diff.commit) {
      lines.push(`- Commit: ${diff.commit}`);
    }
    if (diff.dirtyFiles.length > 0) {
      lines.push(`- Dirty files: ${diff.dirtyFiles.join(", ")}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function buildHandoffMarkdown(scan: ScanResult, prompt: string, diff: GitDiffSummary | undefined): string {
  const lines = [
    "# TODO Numbers Agent Handoff",
    "",
    "## Summary",
    "",
    `- Root: ${scan.root}`,
    `- Files scanned: ${scan.filesScanned}`,
    `- Files with TODOs: ${scan.filesWithTodos}`,
    `- TODOs found: ${scan.todosFound}`,
    `- Renumber edits needed: ${scan.editsNeeded}`,
    `- Conflicts found: ${scan.conflictsFound}`,
    "",
    "## TODO Inventory",
    ""
  ];

  if (scan.files.length === 0) {
    lines.push("- No tracked TODOs found.");
  } else {
    for (const file of scan.files) {
      for (const todo of file.todos) {
        lines.push(`- ${file.file}:${todo.line} TODO #${todo.number}${todo.pinned ? " [pin]" : ""}: ${todo.text}`);
      }
    }
  }

  if (scan.conflicts.length > 0) {
    lines.push("", "## Merge and Numbering Conflicts", "");
    for (const conflict of scan.conflicts) {
      lines.push(`- ${conflict.type}: ${conflict.message}`);
    }
  }

  if (diff) {
    lines.push("", "## Git Diff", "", buildDiffMarkdown(diff).trimEnd());
  }

  lines.push("", "## Takeover Prompt", "", "```text", prompt.trimEnd(), "```", "");
  return `${lines.join("\n")}`;
}

function buildDiffMarkdown(diff: GitDiffSummary): string {
  if (!diff.available) {
    return `# Git Diff Summary\n\nGit diff metadata is unavailable: ${diff.error ?? "not a git repository"}.\n`;
  }

  const lines = [
    "# Git Diff Summary",
    "",
    `- Branch: ${diff.branch ?? "unknown"}`,
    `- Commit: ${diff.commit ?? "unknown"}`,
    `- Dirty files: ${diff.dirtyFiles.length > 0 ? diff.dirtyFiles.join(", ") : "none"}`,
    "",
    "```text",
    diff.summary?.trimEnd() || "No diff summary.",
    "```",
    ""
  ];
  return lines.join("\n");
}

function buildPromptTemplate(): string {
  return [
    "# TODO Numbers Agent Takeover Prompt",
    "",
    "You are taking over a repository that uses numbered TODO comments.",
    "",
    "1. Read `.todo-verbose/handoffs/*/HANDOFF.md` when present.",
    "2. Run `todo-numbers scan . --json` to get the current TODO inventory.",
    "3. Resolve duplicate or stale TODO numbers before editing unrelated code.",
    "4. Summarize completed work across tracked TODOs before handing off.",
    "5. Run `todo-numbers handoff . --include-diff --json` to prepare the next handoff pack.",
    ""
  ].join("\n");
}

function buildAgentSkillDocument(target: AgentSkillTarget): string {
  const title = target === "claude-code" ? "Claude Code" : target === "codex" ? "Codex" : "Generic CLI Agent";
  return [
    "---",
    "name: todo-numbers-handoff",
    "description: Use when taking over, validating, or handing off numbered TODO work in a repository.",
    "---",
    "",
    `# TODO Numbers Handoff Skill for ${title}`,
    "",
    "Use this skill when a repository contains numbered TODO comments managed by TODO VS Code Number Bumper.",
    "",
    "## Workflow",
    "",
    "1. Run `todo-numbers scan . --json` to inventory TODOs and inspect `conflicts`.",
    "2. Run `todo-numbers check . --json` before making changes so stale numbering is visible.",
    "3. Read `.todo-verbose/prompt-template.md` and the newest `.todo-verbose/handoffs/*/HANDOFF.md` when present.",
    "4. Keep inline TODO comments short; put verbose handoff context in `.todo-verbose/` files.",
    "5. When handing off, run `todo-numbers handoff . --include-diff --json`.",
    "6. If numbering drifted during edits, run `todo-numbers handoff . --apply-renumber --include-diff --json`.",
    "",
    "## Expected Handoff Summary",
    "",
    "- What changed for each tracked TODO.",
    "- Which TODOs remain open or blocked.",
    "- Any duplicate or stale TODO numbers reported by the CLI.",
    "- Git branch, commit, and dirty-file context when available.",
    ""
  ].join("\n");
}

function buildGenericAgentAdapter(): string {
  return [
    "# TODO Numbers Generic Agent Adapter",
    "",
    "Agents that can call shell commands should use this sequence:",
    "",
    "```sh",
    "todo-numbers scan . --json",
    "todo-numbers check . --json",
    "todo-numbers handoff . --include-diff --json",
    "```",
    "",
    "Treat `.todo-verbose/` as local handoff context. It is intentionally gitignored by default.",
    ""
  ].join("\n");
}

function getGitDiffSummary(rootPath: string): GitDiffSummary {
  try {
    const branch = runGit(rootPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const commit = runGit(rootPath, ["rev-parse", "--short", "HEAD"]);
    const status = runGit(rootPath, ["status", "--short"]);
    const summary = runGit(rootPath, ["diff", "--stat"]);
    return {
      available: true,
      branch,
      commit,
      dirtyFiles: status.split("\n").map((line) => line.trim()).filter(Boolean),
      summary
    };
  } catch (error) {
    return {
      available: false,
      dirtyFiles: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function runGit(rootPath: string, args: readonly string[]): string {
  return childProcess.execFileSync("git", args, {
    cwd: rootPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function ensureTodoVerboseGitignore(rootPath: string, filesWritten: string[]): void {
  const gitignorePath = path.join(rootPath, ".gitignore");
  const entry = ".todo-verbose/";
  const current = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
  const lines = current.split(/\r?\n/).map((line) => line.trim());

  if (lines.includes(entry)) {
    return;
  }

  const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  writeFile(gitignorePath, `${current}${prefix}${entry}\n`, filesWritten);
}

function writeFile(filePath: string, content: string, filesWritten: string[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  filesWritten.push(filePath);
}

function uniqueDirectoryPath(directoryPath: string): string {
  if (!fs.existsSync(directoryPath)) {
    return directoryPath;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${directoryPath}-${index}`;
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to create unique handoff directory for ${directoryPath}.`);
}

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join("");
}

function defaultInstallRoot(target: AgentSkillTarget): string {
  if (process.env.TODO_NUMBERS_AGENT_SKILLS_DIR) {
    return process.env.TODO_NUMBERS_AGENT_SKILLS_DIR;
  }

  if (target === "codex") {
    return path.join(os.homedir(), ".codex", "skills");
  }

  if (target === "generic") {
    return path.join(os.homedir(), ".todo-numbers", "agent-skills");
  }

  return path.join(os.homedir(), ".claude", "skills");
}
