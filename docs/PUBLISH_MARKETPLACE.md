# Publish to the VS Code Marketplace

This project can be packaged today, but public Marketplace publishing requires a Marketplace publisher identity and authentication controlled by the maintainer.

Official docs:

- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://code.visualstudio.com/api/references/extension-manifest
- https://marketplace.visualstudio.com/manage

## Current Status

- `package.json` uses publisher candidate `kyl33r`.
- `package.json` uses MIT license metadata.
- `LICENSE` contains the MIT license text.
- Before publishing, verify that Marketplace publisher `kyl33r` exists or update `package.json` to the exact publisher ID you create.
- Run the full verification checklist after the final commit.

## One-Time Setup

1. Sign in with a Microsoft account.
2. Open the Marketplace publisher management page:

   ```txt
   https://marketplace.visualstudio.com/manage
   ```

3. Create or select publisher `kyl33r`. If that ID is unavailable, choose the exact publisher ID you will use and update `package.json`.
4. Choose the publisher ID carefully. It becomes part of the extension identifier and Marketplace URL, and cannot be changed later.
5. Create an Azure DevOps Personal Access Token with Marketplace `Manage` scope.

Official docs note that global Azure DevOps PATs retire on December 1, 2026. PAT publishing works today, but CI/CD should move to Microsoft Entra-based publishing.

## Required Repo Check

Confirm `package.json` matches the Marketplace publisher ID:

```json
{
  "publisher": "kyl33r",
  "license": "MIT"
}
```

If the Marketplace publisher ID is not `kyl33r`, update `package.json`, rerun verification, commit, and push before publishing.

## Verify Before Publishing

Run:

```sh
npm install
npm test
npm audit --omit=dev
npm run package
```

Optional package content check:

```sh
npm run package:list
```

Install the VSIX locally:

```sh
code --install-extension todo-vscode-number-bumper-0.1.0.vsix --force
```

Confirm local install:

```sh
code --list-extensions --show-versions | rg 'kyl33r\.todo-vscode-number-bumper@'
```

Run the manual smoke tests in `VERIFICATION.md`.

## Publish With `vsce`

Authenticate:

```sh
npx vsce login kyl33r
```

Paste the Azure DevOps PAT when prompted. Do not commit the token.

Publish:

```sh
npm run publish:marketplace
```

Equivalent direct command:

```sh
npx vsce publish
```

To publish with a version bump:

```sh
npx vsce publish patch
```

## Manual Upload Alternative

1. Run:

   ```sh
   npm run package
   ```

2. Open:

   ```txt
   https://marketplace.visualstudio.com/manage
   ```

3. Select the publisher.
4. Upload `todo-vscode-number-bumper-0.1.0.vsix`.

## After Publishing

Confirm the Marketplace page is live, then test a clean Marketplace install:

```sh
code --install-extension kyl33r.todo-vscode-number-bumper
```

Users can also search for `TODO VS Code Number Bumper` in the VS Code Extensions view.
