import { cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const releaseRoot = path.join(projectRoot, "src-tauri", "target", "release");
const outputRoot = path.join(projectRoot, "release", "tauri");
const installerOutput = path.join(outputRoot, "installer");
const staticAssetsSource = path.join(
  projectRoot,
  "public",
  "static-data",
  "assets",
);
const mode = process.argv[2] || "all";

if (!["all", "installer", "portable"].includes(mode)) {
  throw new Error("用法：yarn package [--installer|--portable]");
}

const yarnCommand = process.platform === "win32" ? "yarn.cmd" : "yarn";

function runYarn(args) {
  const result = spawnSync(yarnCommand, args, {
    cwd: projectRoot,
    stdio: "inherit",
    // Windows 的 yarn.cmd 需要通过 shell 启动，否则 spawnSync 会返回 EINVAL。
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function isDirectory(targetPath) {
  try {
    return (await stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function readTauriConfig() {
  const config = JSON.parse(
    await readFile(
      path.join(projectRoot, "src-tauri", "tauri.conf.json"),
      "utf8",
    ),
  );
  const productName = config.productName;
  const version = config.version;
  const mainBinaryName = config.mainBinaryName || productName;

  if (
    typeof productName !== "string" ||
    typeof version !== "string" ||
    typeof mainBinaryName !== "string"
  ) {
    throw new Error(
      "无法从 src-tauri/tauri.conf.json 读取 productName、version 或 mainBinaryName",
    );
  }

  return { productName, version, mainBinaryName };
}

async function copyInstaller({ productName, version }) {
  const source = path.join(releaseRoot, "bundle", "nsis");
  if (!(await isDirectory(source))) {
    throw new Error(`未找到 NSIS 安装包目录：${source}`);
  }

  const entries = await readdir(source, { withFileTypes: true });
  const installer = entries.find(
    (entry) =>
      entry.isFile() && entry.name.toLowerCase().endsWith("-setup.exe"),
  );
  if (!installer) {
    throw new Error(`未找到 NSIS 安装包文件：${source}`);
  }

  await rm(installerOutput, { recursive: true, force: true });
  await mkdir(installerOutput, { recursive: true });
  await cp(
    path.join(source, installer.name),
    path.join(installerOutput, `${productName}-${version}.exe`),
  );
}

async function copyPortable({ productName, version, mainBinaryName }) {
  const portableOutput = path.join(
    outputRoot,
    "portable",
    `${productName}-${version}`,
  );
  const executable = path.join(releaseRoot, `${mainBinaryName}.exe`);
  if (!(await isDirectory(staticAssetsSource))) {
    throw new Error(`未找到静态资源目录：${staticAssetsSource}`);
  }

  try {
    if (!(await stat(executable)).isFile()) {
      throw new Error(`未找到 Tauri 可执行文件：${executable}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("未找到")) {
      throw error;
    }
    throw new Error(`未找到 Tauri 可执行文件：${executable}`);
  }

  await rm(portableOutput, { recursive: true, force: true });
  await mkdir(path.join(portableOutput, "static-data"), {
    recursive: true,
  });
  await cp(executable, path.join(portableOutput, `${productName}.exe`));
  await cp(
    staticAssetsSource,
    path.join(portableOutput, "static-data", "assets"),
    { recursive: true },
  );
}

async function main() {
  const artifactConfig = await readTauriConfig();

  if (mode === "all" || mode === "portable") {
    // 先只构建应用本体，后续 NSIS 直接复用同一份 release 产物，避免重复编译。
    runYarn(["tauri", "build", "--no-bundle"]);
  }

  if (mode === "installer") {
    runYarn(["tauri", "build", "--bundles", "nsis"]);
  } else if (mode === "all") {
    // bundle 阶段只生成 NSIS，不会触发 WiX/MSI 工具链。
    runYarn(["tauri", "bundle", "--bundles", "nsis"]);
  }

  if (mode === "all" || mode === "installer") {
    await copyInstaller(artifactConfig);
  }
  if (mode === "all" || mode === "portable") {
    await copyPortable(artifactConfig);
  }

  console.log(`\n产物已整理到：${outputRoot}`);
  if (mode === "all" || mode === "installer") {
    console.log(`- NSIS 安装包：${installerOutput}`);
  }
  if (mode === "all" || mode === "portable") {
    console.log(
      `- 免安装目录：${path.join(
        outputRoot,
        "portable",
        `${artifactConfig.productName}-${artifactConfig.version}`,
      )}`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
