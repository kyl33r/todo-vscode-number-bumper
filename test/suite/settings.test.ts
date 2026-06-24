import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { isUriExcluded } from "../../src/config/settings";

suite("settings", () => {
  test("applies excludes to remote workspace document URIs", () => {
    const folderUri = vscode.Uri.parse("vscode-remote://ssh-remote+dev/home/me/project");
    const documentUri = vscode.Uri.parse("vscode-remote://ssh-remote+dev/home/me/project/data-dumps/raw.dump");

    assert.equal(
      isUriExcluded(documentUri, ["**/data-dumps/**"], [{ uri: folderUri, name: "project", index: 0 }]),
      true
    );
  });

  test("does not exclude unmatched remote workspace document URIs", () => {
    const folderUri = vscode.Uri.parse("vscode-remote://ssh-remote+dev/home/me/project");
    const documentUri = vscode.Uri.parse("vscode-remote://ssh-remote+dev/home/me/project/src/app.ts");

    assert.equal(
      isUriExcluded(documentUri, ["**/data-dumps/**"], [{ uri: folderUri, name: "project", index: 0 }]),
      false
    );
  });
});
