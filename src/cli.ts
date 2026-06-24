#!/usr/bin/env node
import * as path from "node:path";
import {
  createAgentHandoff,
  installAgentSkill,
  verifyAgentSkill,
  type AgentHandoffResult,
  type AgentSkillInstallResult,
  type AgentSkillTarget,
  type AgentSkillVerifyResult
} from "./core/agentHandoff";
import { DEFAULT_EXCLUDED_FILE_PATTERNS } from "./core/pathFilters";
import {
  applyFixes,
  readWorkspaceSettings,
  scanWorkspace,
  type FixResult,
  type ScanResult
} from "./core/workspaceTodos";
import { DEFAULT_TODO_PATTERN } from "./parser/todoParser";

type CliCommand = "scan" | "check" | "fix" | "handoff" | "agent-skill";
type AgentSkillAction = "install" | "verify";

type CliOptions = {
  command: CliCommand;
  agentSkillAction?: AgentSkillAction;
  rootPath: string;
  todoPattern: string;
  excludeFiles: string[];
  json: boolean;
  promptOnly: boolean;
  includeDiff: boolean;
  applyRenumber: boolean;
  target: AgentSkillTarget;
  installDir?: string;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function executeCli(rawArgs: readonly string[], cwd = process.cwd()): CliResult {
  try {
    const options = parseArgs(rawArgs, cwd);
    return runCommand(options);
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
  if (options.command === "agent-skill") {
    return runAgentSkillCommand(options);
  }

  const workspaceOptions = {
    rootPath: options.rootPath,
    todoPattern: options.todoPattern,
    excludeFiles: options.excludeFiles
  };

  if (options.command === "handoff") {
    const result = createAgentHandoff({
      ...workspaceOptions,
      promptOnly: options.promptOnly,
      includeDiff: options.includeDiff,
      applyRenumber: options.applyRenumber
    });
    return {
      exitCode: result.ok ? 0 : 1,
      stdout: formatHandoffResult(result, options.json),
      stderr: ""
    };
  }

  const scanResult = scanWorkspace(workspaceOptions);

  if (options.command === "scan") {
    return {
      exitCode: 0,
      stdout: formatScanResult("scan", scanResult, options.json),
      stderr: ""
    };
  }

  if (options.command === "check") {
    const isClean = scanResult.editsNeeded === 0 && scanResult.conflictsFound === 0;
    return {
      exitCode: isClean ? 0 : 1,
      stdout: formatScanResult("check", scanResult, options.json),
      stderr: ""
    };
  }

  const fixResult = applyFixes(workspaceOptions, scanResult);
  return {
    exitCode: 0,
    stdout: formatFixResult(fixResult, options.json),
    stderr: ""
  };
}

function runAgentSkillCommand(options: CliOptions): CliResult {
  if (options.agentSkillAction === "install") {
    const result = installAgentSkill({
      rootPath: options.rootPath,
      target: options.target,
      installRoot: options.installDir
    });
    return {
      exitCode: result.ok ? 0 : 1,
      stdout: formatAgentSkillInstallResult(result, options.json),
      stderr: ""
    };
  }

  const result = verifyAgentSkill({
    target: options.target,
    installRoot: options.installDir
  });
  return {
    exitCode: result.ok ? 0 : 1,
    stdout: formatAgentSkillVerifyResult(result, options.json),
    stderr: ""
  };
}

function parseArgs(rawArgs: readonly string[], cwd: string): CliOptions {
  const args = [...rawArgs];
  const command = args.shift();
  if (!isCommand(command)) {
    throw new Error("Expected command: scan, check, fix, handoff, or agent-skill.");
  }

  const agentSkillAction = readAgentSkillAction(command, args);
  let rootPath = cwd;
  let todoPattern: string | undefined;
  const cliExcludeFiles: string[] = [];
  let json = command === "scan";
  let promptOnly = false;
  let includeDiff = false;
  let applyRenumber = false;
  let target: AgentSkillTarget = "claude-code";
  let installDir: string | undefined;

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

    if (arg === "--prompt-only") {
      promptOnly = true;
      continue;
    }

    if (arg === "--include-diff") {
      includeDiff = true;
      continue;
    }

    if (arg === "--apply-renumber") {
      applyRenumber = true;
      continue;
    }

    if (arg === "--install-dir") {
      installDir = path.resolve(cwd, readOptionValue("--install-dir", args));
      continue;
    }

    if (arg === "--target") {
      target = readAgentSkillTarget(readOptionValue("--target", args));
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
    agentSkillAction,
    rootPath,
    todoPattern: todoPattern ?? workspaceSettings.todoPattern ?? DEFAULT_TODO_PATTERN,
    excludeFiles: [
      ...DEFAULT_EXCLUDED_FILE_PATTERNS,
      ...workspaceSettings.excludeFiles,
      ...cliExcludeFiles
    ],
    json,
    promptOnly,
    includeDiff,
    applyRenumber,
    target,
    installDir
  };
}

function readAgentSkillAction(command: CliCommand, args: string[]): AgentSkillAction | undefined {
  if (command !== "agent-skill") {
    return undefined;
  }

  const action = args.shift();
  if (action === "install" || action === "verify") {
    return action;
  }

  throw new Error("Expected agent-skill action: install or verify.");
}

function formatScanResult(command: "scan" | "check", result: ScanResult, json: boolean): string {
  const ok = result.editsNeeded === 0 && result.conflictsFound === 0;
  if (json) {
    return `${JSON.stringify({ command, ok, ...result }, null, 2)}\n`;
  }

  if (ok) {
    return `Todo Numbers: ${result.todosFound} TODO(s) found across ${result.filesWithTodos} file(s); numbering is clean.\n`;
  }

  return `Todo Numbers: ${result.editsNeeded} renumber edit(s) and ${result.conflictsFound} conflict(s) found across ${result.filesNeedingRenumber} file(s).\n`;
}

function formatFixResult(result: FixResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify({ command: "fix", ok: true, ...result }, null, 2)}\n`;
  }

  return `Todo Numbers: applied ${result.editsApplied} edit(s) across ${result.filesChanged} file(s).\n`;
}

function formatHandoffResult(result: AgentHandoffResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  if (!result.packPath) {
    return result.prompt;
  }

  const state = result.ok ? "ready" : "needs attention";
  return `Todo Numbers: created handoff pack at ${result.packPath}; numbering state ${state}.\n`;
}

function formatAgentSkillInstallResult(result: AgentSkillInstallResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return result.ok
    ? `Todo Numbers: installed ${result.target} agent skill at ${result.skillPath}.\n`
    : `Todo Numbers: wrote ${result.target} agent skill at ${result.skillPath}, but verification failed.\n`;
}

function formatAgentSkillVerifyResult(result: AgentSkillVerifyResult, json: boolean): string {
  if (json) {
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  return result.ok
    ? `Todo Numbers: verified ${result.target} agent skill at ${result.skillPath}.\n`
    : `Todo Numbers: could not verify ${result.target} agent skill at ${result.skillPath}: ${result.reason ?? "unknown reason"}.\n`;
}

function isCommand(value: string | undefined): value is CliCommand {
  return value === "scan" || value === "check" || value === "fix" || value === "handoff" || value === "agent-skill";
}

function readAgentSkillTarget(value: string): AgentSkillTarget {
  if (value === "claude-code" || value === "codex" || value === "generic") {
    return value;
  }

  throw new Error(`Unknown agent skill target: ${value}.`);
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
    "Usage: todo-numbers <scan|check|fix|handoff> [root] [options]",
    "       todo-numbers agent-skill <install|verify> [root] [options]",
    "",
    "Options:",
    "  --json                Print JSON output.",
    "  --no-json             Print a compact human-readable summary.",
    "  --pattern <regex>     Override the TODO regex.",
    "  --exclude <glob>      Add an exclude glob. Can be repeated or comma-separated.",
    "  --prompt-only         For handoff, print only the takeover prompt and write no files.",
    "  --include-diff        For handoff, include Git branch, commit, dirty files, and diff summary.",
    "  --apply-renumber      For handoff, apply deterministic renumbering before generating the pack.",
    "  --target <name>       Agent skill target: claude-code, codex, or generic.",
    "  --install-dir <path>  Agent skill install root for install or verify.",
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
