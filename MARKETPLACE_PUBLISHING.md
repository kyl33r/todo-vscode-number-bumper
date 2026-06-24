# Publishing to the VS Code Marketplace

This repo is technically packageable today, but publishing requires a real Visual Studio Marketplace publisher identity and authentication token controlled by the maintainer.

Official docs:

- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://code.visualstudio.com/api/references/extension-manifest
- https://marketplace.visualstudio.com/manage

## Current Repo Status

- Local package works: `npm run package`.
- Local VSIX install works: `code --install-extension todo-vscode-number-bumper-0.1.0.vsix --force`.
- Extension-host tests pass: `npm test`.
- Production dependency audit is clean: `npm audit --omit=dev`.
- `package.json` still uses the placeholder publisher `local-dev`; replace it before publishing.
- The package is currently marked `UNLICENSED`; choose a public license or keep an explicit proprietary license before publishing publicly.

## One-Time Marketplace Setup

1. Sign in with a Microsoft account.
2. Create or select an Azure DevOps organization.
3. Create a Marketplace publisher at:

   ```txt
   https://marketplace.visualstudio.com/manage
   ```

4. Pick the publisher ID carefully. It becomes part of the extension identifier and URL, and the ID cannot be changed after creation.
5. Create a Personal Access Token in Azure DevOps with Marketplace `Manage` scope.

Important: official VS Code docs say global Azure DevOps PATs retire on December 1, 2026. PAT publishing still works today, but CI/CD should move to Microsoft Entra ID based publishing.

## Repo Changes Before First Public Publish

Update `package.json`:

```json
{
  "publisher": "<your-marketplace-publisher-id>",
  "license": "SEE LICENSE IN LICENSE"
}
```

Recommended but optional:

- Add a public `repository` URL.
- Add `bugs.url` and `homepage`.
- Add a PNG icon of at least 128x128 and reference it with `"icon": "images/icon.png"`.
- Replace the placeholder support details in `SUPPORT.md`.
- Confirm `README.md` is what you want users to see on the Marketplace page.

## Pre-Publish Verification

Run:

```sh
npm install
npm run compile
npm test
npm audit --omit=dev
npm run package
npm run package:list
```

Install the generated VSIX locally:

```sh
code --install-extension todo-vscode-number-bumper-0.1.0.vsix --force
code --list-extensions --show-versions | rg '<your-marketplace-publisher-id>\.todo-vscode-number-bumper@'
```

Run the manual smoke test in `VERIFICATION.md`.

## Publish With `vsce`

Authenticate:

```sh
npx vsce login <your-marketplace-publisher-id>
```

When prompted, paste the Azure DevOps PAT. Do not commit the token.

Publish:

```sh
npm run publish:marketplace
```

Equivalent direct command:

```sh
npx vsce publish
```

You can also publish a version bump:

```sh
npx vsce publish patch
```

## Manual Upload Alternative

If CLI authentication is inconvenient:

1. Run `npm run package`.
2. Open https://marketplace.visualstudio.com/manage.
3. Select the publisher.
4. Upload `todo-vscode-number-bumper-0.1.0.vsix`.

## After Publishing

Confirm the Marketplace page is live, then test a clean install:

```sh
code --install-extension <your-marketplace-publisher-id>.todo-vscode-number-bumper
```

Users can also search for `TODO VS Code Number Bumper` in the VS Code Extensions view.
