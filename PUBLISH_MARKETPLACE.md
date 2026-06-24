# Publish to the VS Code Marketplace

This project can be packaged today, but public Marketplace publishing requires a real Marketplace publisher identity and authentication controlled by the maintainer.

Official docs:

- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://code.visualstudio.com/api/references/extension-manifest
- https://marketplace.visualstudio.com/manage

## Current Status

- Source is pushed to `origin/main`.
- `npm test` passes.
- `npm audit --omit=dev` reports 0 production vulnerabilities.
- `npm run package` builds `todo-vscode-number-bumper-0.1.0.vsix`.
- `package.json` still uses the placeholder publisher `local-dev`.
- `package.json` still uses `UNLICENSED`.

## One-Time Setup

1. Sign in with a Microsoft account.
2. Open the Marketplace publisher management page:

   ```txt
   https://marketplace.visualstudio.com/manage
   ```

3. Create a publisher.
4. Choose the publisher ID carefully. It becomes part of the extension identifier and Marketplace URL, and cannot be changed later.
5. Create an Azure DevOps Personal Access Token with Marketplace `Manage` scope.

Official docs note that global Azure DevOps PATs retire on December 1, 2026. PAT publishing works today, but CI/CD should move to Microsoft Entra-based publishing.

## Required Repo Changes

Update `package.json`:

```json
{
  "publisher": "<your-publisher-id>",
  "license": "SEE LICENSE IN LICENSE"
}
```

Replace `<your-publisher-id>` with the real publisher ID from the Marketplace management page.

Choose a public license before publishing, or replace `LICENSE` with the proprietary license text you want users to see.

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
code --list-extensions --show-versions | rg '<your-publisher-id>\.todo-vscode-number-bumper@'
```

Run the manual smoke tests in `VERIFICATION.md`.

## Publish With `vsce`

Authenticate:

```sh
npx vsce login <your-publisher-id>
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
code --install-extension <your-publisher-id>.todo-vscode-number-bumper
```

Users can also search for `TODO VS Code Number Bumper` in the VS Code Extensions view.
