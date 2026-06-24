import * as vscode from "vscode";
import {
  createAgentHandoff,
  installAgentSkill,
  type AgentHandoffResult,
  type AgentSkillInstallResult,
  type AgentSkillTarget
} from "../core/agentHandoff";
import { DEFAULT_EXCLUDED_FILE_PATTERNS } from "../core/pathFilters";
import { getExcludedFilePatterns, getTodoPattern } from "../config/settings";

type AgentHandoffCommandOptions = {
  rootPath?: string;
  promptOnly?: boolean;
  includeDiff?: boolean;
  applyRenumber?: boolean;
  now?: string | Date;
  confirm?: boolean;
};

type AgentSkillCommandOptions = {
  rootPath?: string;
  target?: AgentSkillTarget;
  installRoot?: string;
  confirm?: boolean;
};

const FIRST_RUN_PROMPT_KEY = "todoNumbers.agentIntegrationPromptShown";

export async function createAgentHandoffCommand(
  options: AgentHandoffCommandOptions = {}
): Promise<AgentHandoffResult | { command: "handoff"; ok: false; reason: string }> {
  const rootPath = options.rootPath ?? getWorkspaceRootPath();
  if (!rootPath) {
    void vscode.window.showInformationMessage("Todo Numbers: open a workspace before creating an agent handoff.");
    return { command: "handoff", ok: false, reason: "No workspace is open." };
  }

  const result = createAgentHandoff({
    rootPath,
    todoPattern: getTodoPattern(),
    excludeFiles: [...DEFAULT_EXCLUDED_FILE_PATTERNS, ...getExcludedFilePatterns()],
    promptOnly: options.promptOnly,
    includeDiff: options.includeDiff,
    applyRenumber: options.applyRenumber,
    now: normalizeDate(options.now)
  });

  if (options.confirm !== false && result.packPath) {
    void vscode.window.showInformationMessage(`Todo Numbers: created agent handoff at ${result.packPath}.`);
  }

  return result;
}

export async function installAgentSkillCommand(
  options: AgentSkillCommandOptions = {}
): Promise<AgentSkillInstallResult | (AgentSkillInstallResult & { cancelled: true })> {
  const rootPath = options.rootPath ?? getWorkspaceRootPath();
  const target = options.target ?? "claude-code";
  if (!rootPath) {
    const installRoot = options.installRoot ?? "";
    return {
      command: "agent-skill install",
      ok: false,
      target,
      installRoot,
      skillPath: "",
      verified: false,
      filesWritten: [],
      cancelled: true
    };
  }

  if (options.confirm !== false) {
    const choice = await vscode.window.showInformationMessage(
      `Todo Numbers can install a ${target} handoff skill. It will write files only after this confirmation.`,
      { modal: true },
      "Install Agent Skill"
    );

    if (choice !== "Install Agent Skill") {
      return {
        command: "agent-skill install",
        ok: false,
        target,
        installRoot: options.installRoot ?? "",
        skillPath: "",
        verified: false,
        filesWritten: [],
        cancelled: true
      };
    }
  }

  const result = installAgentSkill({
    rootPath,
    target,
    installRoot: options.installRoot
  });

  if (options.confirm !== false) {
    void vscode.window.showInformationMessage(`Todo Numbers: installed ${target} agent skill at ${result.skillPath}.`);
  }

  return result;
}

export async function maybeShowAgentIntegrationSetup(context: vscode.ExtensionContext): Promise<void> {
  if (context.extensionMode !== vscode.ExtensionMode.Production) {
    return;
  }

  if (context.globalState.get<boolean>(FIRST_RUN_PROMPT_KEY, false)) {
    return;
  }

  await context.globalState.update(FIRST_RUN_PROMPT_KEY, true);
  const choice = await vscode.window.showInformationMessage(
    "Todo Numbers can install an optional handoff skill for coding agents.",
    "Install Agent Skill",
    "Later"
  );

  if (choice === "Install Agent Skill") {
    await installAgentSkillCommand({ confirm: false });
  }
}

function getWorkspaceRootPath(): string | undefined {
  return vscode.workspace.workspaceFolders?.find((folder) => folder.uri.scheme === "file")?.uri.fsPath;
}

function normalizeDate(value: string | Date | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value : new Date(value);
}
