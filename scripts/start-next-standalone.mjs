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
    HOSTNAME: process.env.HOSTNAME || "0.0.0.0",
    PORT: process.env.PORT || "12831",
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
