import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), "todo-numbers-test-"));
  const options: Parameters<typeof runTests>[0] = {
    extensionDevelopmentPath,
    extensionTestsPath,
    launchArgs: [workspacePath, "--disable-workspace-trust"]
  };

  if (process.env.VSCODE_EXECUTABLE_PATH) {
    options.vscodeExecutablePath = process.env.VSCODE_EXECUTABLE_PATH;
  }

  await runTests(options);
}

main().catch((error) => {
  console.error("Failed to run extension tests", error);
  process.exit(1);
});
