# Verification and Install Checklist

Use this checklist after code changes to verify the extension and prove it can be installed into VS Code.

## Automated Checks

1. Install dependencies:

   ```sh
   npm install
   ```

2. Compile TypeScript:

   ```sh
   npm run compile
   ```

3. Run the full isolated VS Code Electron test suite:

   ```sh
   npm test
   ```

4. The test runner creates a temporary workspace, user-data directory, and extensions directory for the VS Code Electron instance. CLI tests, parser tests, renumber engine tests, and VS Code command tests all run inside that extension-host process.

5. Run CLI tests directly only when debugging the CLI outside VS Code:

   ```sh
   node ./out/src/cli.js scan . --json
   ```

6. Package a local VSIX:

   ```sh
   npm run package
   ```

The package step should create a file like `todo-vscode-number-bumper-0.1.0.vsix`.

## Install Into VS Code

Install the generated VSIX:

```sh
code --install-extension todo-vscode-number-bumper-0.1.0.vsix --force
```

Confirm the extension is installed:

```sh
code --list-extensions --show-versions | rg '^local-dev\.todo-vscode-number-bumper@'
```

Uninstall after manual verification if desired:

```sh
code --uninstall-extension local-dev.todo-vscode-number-bumper
```

## Manual Smoke Test

1. Open VS Code.
2. Create or open a scratch file with:

   ```ts
   // TODO #1: Setup API
   // TODO #3: Add tests
   // TODO #99 [pin]: External tracker
   // TODO #5: Clean up
   ```

3. Run `Todo Numbers: Renumber Current File` from the Command Palette.
4. Verify the file becomes:

   ```ts
   // TODO #1: Setup API
   // TODO #2: Add tests
   // TODO #99 [pin]: External tracker
   // TODO #3: Clean up
   ```

5. Put the cursor on the `TODO #2` line and run `Todo Numbers: Insert TODO After Current`.
6. Verify a new `TODO #3: New TODO` is inserted and the later unpinned TODO shifts to `TODO #4`.
7. Run `Todo Numbers: Toggle Auto Renumber On Save`.
8. Change `TODO #4` to `TODO #9`, save the file, and verify the extension renumbers it after save.

## Multi-File and Code-Between-TODO Smoke Test

1. Open two scratch files side by side.
2. In the first file, add:

   ```ts
   // TODO #1: Setup API
   export const apiReady = false;
   // TODO #3: Add tests
   ```

3. In the second file, add:

   ```ts
   // TODO #1: Keep this
   export const untouched = true;
   // TODO #9: Do not change during first-file command
   ```

4. Focus the first file and run `Todo Numbers: Renumber Current File`.
5. Verify the first file changes only `TODO #3` to `TODO #2`.
6. Verify the code line in the first file is unchanged.
7. Verify the second file is unchanged.

## Excluded File Smoke Test

1. Add this workspace setting:

   ```json
   {
     "todoNumbers.excludeFiles": ["**/data-dumps/**"]
   }
   ```

2. Create `data-dumps/raw-export.dump` with:

   ```txt
   // TODO #1: First coincidental marker
   raw_payload=TODO #9: This belongs to a data dump
   // TODO #8: Last coincidental marker
   ```

3. Open that file and run `Todo Numbers: Renumber Current File`.
4. Verify the file is unchanged.
5. Run `Todo Numbers: Insert TODO After Current`.
6. Verify no TODO is inserted.
7. Enable `todoNumbers.autoRenumberOnSave`, edit and save the file, and verify the TODO numbers are still unchanged.

These checks cover installability, command activation, parser behavior, pinned TODO handling, insertion, and save-triggered renumbering.
