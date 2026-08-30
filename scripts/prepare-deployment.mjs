import { access, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readProductionApiBaseUrl } from "./production-env.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deploymentRoot = resolve(projectRoot, "deployment");

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function shouldCopy(sourcePath) {
  // standalone 目录内自带一份裁剪后的 node_modules；服务器执行 yarn 后，
  // Node.js 会从部署根目录的 node_modules 解析 Web 和 API 的运行依赖。
  return !sourcePath.split(/[\\/]/).includes("node_modules");
}

async function containsText(directoryPath, expectedText) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = resolve(directoryPath, entry.name);
    if (entry.isDirectory() && (await containsText(entryPath, expectedText))) {
      return true;
    }

    if (!entry.isFile() || !/\.(?:css|html|js|json)$/.test(entry.name)) {
      continue;
    }

    if ((await readFile(entryPath, "utf8")).includes(expectedText)) {
      return true;
    }
  }

  return false;
}

async function copyRequired(sourceName, targetName = sourceName) {
  const source = resolve(projectRoot, sourceName);
  const target = resolve(deploymentRoot, targetName);

  if (!(await pathExists(source))) {
    throw new Error(`缺少必要的部署产物：${sourceName}`);
  }

  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    force: true,
    recursive: true,
    filter: shouldCopy,
  });
}

async function copyOptional(sourceName, targetName = sourceName) {
  const source = resolve(projectRoot, sourceName);
  if (!(await pathExists(source))) return false;

  const target = resolve(deploymentRoot, targetName);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, {
    force: true,
    recursive: true,
    filter: shouldCopy,
  });
  return true;
}

try {
  // deployment 是可重复生成的临时部署目录，只清理脚本明确管理的目录。
  await rm(deploymentRoot, { force: true, recursive: true });

  const apiBaseUrl = await readProductionApiBaseUrl(projectRoot);
  const staticOutput = resolve(
    projectRoot,
    ".next",
    "standalone",
    ".next",
    "static",
  );
  if (!(await containsText(staticOutput, apiBaseUrl))) {
    throw new Error(
      `Next.js 静态产物未包含生产 API 地址 ${apiBaseUrl}，已停止生成部署包。`,
    );
  }

  await copyRequired(".next/standalone", ".next/standalone");
  await copyRequired("dist", "dist");
  await copyRequired(
    "scripts/start-next-standalone.mjs",
    "scripts/start-next-standalone.mjs",
  );
  await copyRequired("scripts/start-all.mjs", "scripts/start-all.mjs");
  await copyRequired("package.json", "package.json");

  await copyOptional("package-lock.json", "package-lock.json");
  await copyOptional("yarn.lock", "yarn.lock");
  const hasProductionEnvironment = await copyOptional(
    ".env.production",
    ".env.production",
  );

  console.log(`部署目录已生成：${deploymentRoot}`);
  console.log(`已校验浏览器 API 地址：${apiBaseUrl}`);
  console.log(
    "部署目录未包含 node_modules；上传后进入该目录执行 yarn，再执行 yarn start。",
  );

  if (!hasProductionEnvironment) {
    console.warn(
      "未找到 .env.production，请在服务器 deployment 目录中补充生产环境配置。",
    );
  }
} catch (error) {
  console.error("生成部署目录失败。", error);
  process.exitCode = 1;
}
