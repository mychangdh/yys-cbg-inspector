import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneServer = resolve(
  projectRoot,
  ".next",
  "standalone",
  "server.js",
);

function loadProductionEnvironment() {
  // 支持原生读取 .env 文件的 Node.js 会自动加载配置；旧版本仍可使用外部环境变量启动。
  if (typeof process.loadEnvFile !== "function") return;

  try {
    process.loadEnvFile(resolve(projectRoot, ".env.production"));
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
}

loadProductionEnvironment();

try {
  await access(standaloneServer);
} catch {
  console.error("未找到 Next standalone 产物，请先运行 npm run build。\n");
  process.exitCode = 1;
}

if (process.exitCode) process.exit();

const child = spawn(process.execPath, [standaloneServer], {
  cwd: projectRoot,
  env: {
    ...process.env,
    // 不使用 Linux 自动注入的 HOSTNAME，它通常是无法解析的云主机名称。
    HOSTNAME: process.env.WEB_HOSTNAME || "0.0.0.0",
    PORT: process.env.WEB_PORT || "12831",
  },
  stdio: "inherit",
});

const stopChild = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.once("SIGINT", () => stopChild("SIGINT"));
process.once("SIGTERM", () => stopChild("SIGTERM"));

child.on("error", (error) => {
  console.error("启动 Next standalone 服务失败。", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
