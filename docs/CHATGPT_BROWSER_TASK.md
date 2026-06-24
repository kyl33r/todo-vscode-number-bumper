# ChatGPT Atlas Browser Task: Publish TODO VS Code Number Bumper

Paste this prompt into ChatGPT Atlas or another browser-capable agent when it is time to complete the public VS Code Marketplace publishing flow.

## Task Prompt

You are taking over public publishing for the VS Code extension `todo-vscode-number-bumper`.

Repository:

```txt
https://github.com/kyl33r/todo-vscode-number-bumper
```

Local project path used by the coding agent:

```txt
/Users/jianhui/projects/playground/todo-vscode-number-bumper
```

## Goal

Publish the extension publicly to the VS Code Marketplace so users can find, download, and install it from VS Code.

## Current Package Identity

The repo is configured as:

```json
{
  "name": "todo-vscode-number-bumper",
  "displayName": "TODO VS Code Number Bumper",
  "publisher": "kyl33r",
  "license": "MIT",
  "version": "0.1.0"
}
```

Expected extension ID:

```txt
kyl33r.todo-vscode-number-bumper
```

Important: the Marketplace publisher ID must exist server-side. Verify or create publisher `kyl33r` in the Marketplace browser UI before publishing. If `kyl33r` is unavailable, stop and ask the maintainer before publishing under any other publisher ID because publisher IDs become part of the permanent extension identity and URL.

## Required Browser Work

1. Open the Marketplace publisher management page:

   ```txt
   https://marketplace.visualstudio.com/manage
   ```

2. Sign in with the maintainer's Microsoft account.
3. Verify publisher `kyl33r` exists, or create it if it is available.
4. If the UI requires Azure DevOps setup, help the maintainer create or select the Azure DevOps organization needed for Marketplace publishing.
5. Create or guide the maintainer through creating an Azure DevOps Personal Access Token with Marketplace `Manage` scope.
6. Never reveal, store, summarize, or paste the PAT into chat output.
7. Use `vsce login kyl33r` or the Marketplace manual upload flow, depending on what credentials and tooling are available.
8. Publish `todo-vscode-number-bumper@0.1.0`.
9. Open the published Marketplace page and verify it is public.
10. Verify that VS Code can install the published extension by extension ID:

    ```sh
    code --install-extension kyl33r.todo-vscode-number-bumper
    ```

## Required Local Verification Before Publishing

If terminal access is available, run these commands before publishing:

```sh
npm test
npm audit --omit=dev
npm run package:list
npm run package
git diff --check
```

Then verify local VSIX install:

```sh
code --install-extension todo-vscode-number-bumper-0.1.0.vsix --force
code --list-extensions --show-versions | rg '^kyl33r\.todo-vscode-number-bumper@'
```

If terminal access is not available, report that limitation explicitly before publishing and ask the maintainer whether to continue.

## Publishing Options

Preferred CLI flow:

```sh
npx vsce login kyl33r
npm run publish:marketplace
```

Manual browser upload fallback:

1. Run `npm run package`.
2. Open `https://marketplace.visualstudio.com/manage`.
3. Select publisher `kyl33r`.
4. Upload `todo-vscode-number-bumper-0.1.0.vsix`.
5. Verify the Marketplace listing is public.

## Stop Conditions

Stop and ask the maintainer before continuing if:

1. Publisher `kyl33r` is unavailable.
2. The Marketplace UI requires changing the extension ID.
3. Required authentication cannot be completed by the maintainer.
4. `npm test`, packaging, or VSIX install verification fails.
5. `vsce publish` reports that the version already exists.
6. The Marketplace listing is created but not public or not searchable after publishing.

## Required Final Report Format

Report back in this exact ordered structure:

1. **Publishing Result**
   - Status: `published`, `blocked`, or `failed`.
   - Extension ID:
   - Marketplace URL:
   - Version:

2. **What Went Smoothly**
   - Ordered list of steps that completed without issues.

3. **What Went Wrong**
   - Ordered list of failures, blockers, confusing UI issues, or verification gaps.
   - Include exact command names or Marketplace pages involved.
   - Do not include secrets, PAT values, or private account details.

4. **Verification Completed**
   - `npm test`:
   - `npm audit --omit=dev`:
   - `npm run package:list`:
   - `npm run package`:
   - Local VSIX install:
   - Marketplace page visible:
   - Marketplace install:

5. **Manual Actions Needed From Maintainer**
   - Ordered list of anything the maintainer must still do.

6. **Files Or Settings Changed**
   - Ordered list of repo files changed, Marketplace settings changed, or publisher settings changed.

7. **Next Recommended Step**
   - One concrete next action.
