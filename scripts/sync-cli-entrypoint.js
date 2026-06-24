const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "todo-numbers.config.json");
const packagePath = path.join(root, "package.json");
const cliOutputPath = "./out/src/cli.js";

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const cliEntrypoint = config.cliEntrypoint;

if (typeof cliEntrypoint !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(cliEntrypoint)) {
  throw new Error("todo-numbers.config.json cliEntrypoint must be a lowercase npm binary name.");
}

packageJson.bin = {
  [cliEntrypoint]: cliOutputPath
};

fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
