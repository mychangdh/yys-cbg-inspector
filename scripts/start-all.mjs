import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiEntry = resolve(projectRoot, "dist", "server", "main.js");
const webEntry = resolve(projectRoot, "scripts", "start-next-standalone.mjs");
const yarnCommand = process.platform === "win32" ? "yarn.cmd" : "yarn";
const children = [];
let isShuttingDown = false;
let exitCode = 0;

async function ensureEntry(entry, serviceName) {
  try {
    await access(entry);
  } catch {
    throw new Error(`缺少 ${serviceName} 启动入口：${entry}`);
  }
}

function loadRuntimeEnvironment() {
  // 先加载 API 使用的环境文件，让一个启动入口也能正确读取端口和数据库配置。
  if (typeof process.loadEnvFile !== "function") return;

  const environmentName =
    process.env.NODE_ENV?.trim() === "production"
      ? "production"
      : "development";

  for (const fileName of [`.env.${environmentName}`, ".env"]) {
    try {
      process.loadEnvFile(resolve(projectRoot, fileName));
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }
  }
}

function stopChildren(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.pid || child.killed) continue;

    if (process.platform === "win32") {
      // Windows 的 Yarn 子命令还会再创建 Node 子进程，需要结束整棵进程树。
      const taskKill = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/t", "/f"],
        { stdio: "ignore", windowsHide: true },
      );
      taskKill.unref();
      continue;
    }

    try {
      // Linux 下使用独立进程组，确保 Yarn 和它启动的 Node 子进程一起退出。
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  }
}

function requestShutdown(code = 0) {
  if (isShuttingDown) {
    if (code !== 0) exitCode = code;
    return;
  }

  isShuttingDown = true;
  exitCode = code;
  stopChildren();
  process.exitCode = exitCode;
}

function startService(serviceName, scriptName, environment) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : yarnCommand;
  const args = isWindows
    ? ["/d", "/s", "/c", `${yarnCommand} ${scriptName}`]
    : [scriptName];
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
    detached: !isWindows,
    windowsHide: true,
  });

  child.on("error", (error) => {
    console.error(`[${serviceName}] 启动失败。`, error);
    requestShutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (isShuttingDown) return;

    const reason = signal ? `信号 ${signal}` : `退出码 ${code ?? 1}`;
    console.error(`[${serviceName}] 已停止（${reason}），正在关闭其他服务。`);
    requestShutdown(code ?? 1);
  });

  children.push(child);
}

try {
  loadRuntimeEnvironment();
  await ensureEntry(apiEntry, "NestJS API");
  await ensureEntry(webEntry, "Next.js Web");

  const baseEnvironment = { ...process.env };

  // API_PORT 和 API_HOST 允许一键启动时覆盖 API 配置，未设置时沿用 env 文件。
  const apiEnvironment = { ...baseEnvironment };
  if (process.env.API_PORT?.trim()) apiEnvironment.PORT = process.env.API_PORT;
  if (process.env.API_HOST?.trim()) apiEnvironment.HOST = process.env.API_HOST;

  console.log("正在执行 yarn start:api 和 yarn start:web……");
  startService("NestJS API（yarn start:api）", "start:api", apiEnvironment);
  startService("Next.js Web（yarn start:web）", "start:web", baseEnvironment);

  process.once("SIGINT", () => requestShutdown(0));
  process.once("SIGTERM", () => requestShutdown(0));
} catch (error) {
  console.error("一键启动失败。", error);
  process.exitCode = 1;
}
