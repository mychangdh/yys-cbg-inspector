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
  await cp(source, target, { force: true, recursive: true });
}

async function copyOptional(sourceName, targetName = sourceName) {
  const source = resolve(projectRoot, sourceName);
  if (!(await pathExists(source))) return false;

  const target = resolve(deploymentRoot, targetName);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { force: true, recursive: true });
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
  // NestJS 的编译结果仍按 Node.js 模块解析依赖，因此需要携带构建机安装好的完整依赖。
  // standalone 内的裁剪依赖同时保留，确保 Next.js 生产服务使用构建时的依赖树。
  await copyRequired("node_modules", "node_modules");
  await copyRequired("dist", "dist");
  await copyRequired(
    "scripts/start-next-standalone.mjs",
    "scripts/start-next-standalone.mjs",
  );
  await copyRequired("scripts/start-all.mjs", "scripts/start-all.mjs");
  await copyRequired("scripts/start-api.mjs", "scripts/start-api.mjs");
  await copyRequired(
    "scripts/production-env.mjs",
    "scripts/production-env.mjs",
  );
  await copyRequired("package.json", "package.json");

  await copyOptional("package-lock.json", "package-lock.json");
  await copyOptional("yarn.lock", "yarn.lock");
  await copyRequired(
    ".env.production",
    ".env.production",
  );

  console.log(`部署目录已生成：${deploymentRoot}`);
  console.log(`已校验浏览器 API 地址：${apiBaseUrl}`);
  console.log(
    "部署目录已包含 node_modules；上传后无需安装依赖，设置 NODE_ENV=production 后执行 yarn start。",
  );
} catch (error) {
  console.error("生成部署目录失败。", error);
  process.exitCode = 1;
}
