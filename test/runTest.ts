import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-electron-"));
  const workspacePath = path.join(testRoot, "workspace");
  const userDataPath = path.join(testRoot, "user-data");
  const extensionsPath = path.join(testRoot, "extensions");
  fs.mkdirSync(workspacePath, { recursive: true });
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(extensionsPath, { recursive: true });

  const options: Parameters<typeof runTests>[0] = {
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [
      workspacePath,
      "--disable-workspace-trust",
      "--disable-extensions",
      `--user-data-dir=${userDataPath}`,
      `--extensions-dir=${extensionsPath}`
    ]
  };

  if (process.env.VSCODE_EXECUTABLE_PATH) {
    options.vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;
  }

  try {
    await runTests(options);
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error("Failed to run extension tests", error);
  process.exit(1);
});
