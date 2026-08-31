import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProductionEnvironment } from "./production-env.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiEntry = resolve(projectRoot, "dist", "server", "main.js");

try {
  await loadProductionEnvironment(projectRoot);
  await access(apiEntry);
} catch (error) {
  console.error("启动 NestJS API 失败。", error);
  process.exitCode = 1;
}

if (process.exitCode) process.exit();

// API_PORT 和 API_HOST 只作为显式启动覆盖项，普通配置统一来自 .env.production。
const environment = { ...process.env };
if (process.env.API_PORT?.trim()) environment.PORT = process.env.API_PORT;
if (process.env.API_HOST?.trim()) environment.HOST = process.env.API_HOST;

const child = spawn(process.execPath, [apiEntry], {
  cwd: projectRoot,
  env: environment,
  stdio: "inherit",
  windowsHide: true,
});

const stopChild = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.once("SIGINT", () => stopChild("SIGINT"));
process.once("SIGTERM", () => stopChild("SIGTERM"));

child.on("error", (error) => {
  console.error("启动 NestJS API 进程失败。", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
