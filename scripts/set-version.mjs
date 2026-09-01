import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const version = process.argv[2];
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (!version || !semverPattern.test(version)) {
  throw new Error(
    "版本号必须是合法 SemVer，例如：yarn release:version 1.0.0-beta-4",
  );
}

const packagePath = path.join(projectRoot, "package.json");
const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
const cargoPath = path.join(projectRoot, "src-tauri", "Cargo.toml");

const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
const cargoContent = await readFile(cargoPath, "utf8");
const lineEnding = cargoContent.includes("\r\n") ? "\r\n" : "\n";
const cargoLines = cargoContent.split(/\r?\n/);
let inPackageSection = false;
let cargoVersionIndex = -1;

for (let index = 0; index < cargoLines.length; index += 1) {
  const line = cargoLines[index].trim();

  if (line === "[package]") {
    inPackageSection = true;
    continue;
  }
  if (inPackageSection && line.startsWith("[")) {
    break;
  }
  if (inPackageSection && /^version\s*=/.test(line)) {
    cargoVersionIndex = index;
    break;
  }
}

if (cargoVersionIndex === -1) {
  throw new Error("src-tauri/Cargo.toml 中未找到 [package] 的 version 配置");
}

packageJson.version = version;
tauriConfig.version = version;
cargoLines[cargoVersionIndex] = `version = "${version}"`;

await writeFile(
  packagePath,
  `${JSON.stringify(packageJson, null, 2)}\n`,
  "utf8",
);
await writeFile(
  tauriConfigPath,
  `${JSON.stringify(tauriConfig, null, 2)}\n`,
  "utf8",
);
await writeFile(cargoPath, cargoLines.join(lineEnding), "utf8");

console.log(`版本已同步为 ${version}`);
console.log("- package.json");
console.log("- src-tauri/tauri.conf.json");
console.log("- src-tauri/Cargo.toml");
