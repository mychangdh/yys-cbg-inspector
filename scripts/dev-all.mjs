import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];
let isShuttingDown = false;
let exitCode = 0;

function stopChildren(signal = "SIGTERM") {
  for (const child of children) {
    if (!child.pid || child.killed) continue;

    if (process.platform === "win32") {
      // Windows 下 npm 会继续派生 Next.js/tsx 子进程，需要结束整棵进程树。
      const taskKill = spawn(
        "taskkill",
        ["/pid", String(child.pid), "/t", "/f"],
        { stdio: "ignore", windowsHide: true },
      );
      taskKill.unref();
      continue;
    }

    try {
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

function startService(serviceName, scriptName) {
  const isWindows = process.platform === "win32";
  const command = isWindows ? process.env.ComSpec || "cmd.exe" : npmCommand;
  const args = isWindows
    ? ["/d", "/s", "/c", `${npmCommand} run ${scriptName}`]
    : ["run", scriptName];
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" },
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

console.log("正在同时启动 Next.js Web 和 NestJS API……");
startService("NestJS API（npm run dev:api）", "dev:api");
startService("Next.js Web（npm run dev:web）", "dev:web");

process.once("SIGINT", () => requestShutdown(0));
process.once("SIGTERM", () => requestShutdown(0));
