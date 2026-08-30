import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readProductionApiBaseUrl } from "./production-env.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = resolve(projectRoot, "node_modules", "next", "dist", "bin", "next");

try {
  const apiBaseUrl = await readProductionApiBaseUrl(projectRoot);
  await access(nextCli);

  console.log(`生产构建使用 API 地址：${apiBaseUrl}`);

  const child = spawn(process.execPath, [nextCli, "build"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
      // 显式覆盖构建机可能残留的开发环境变量，确保浏览器代码使用生产地址。
      NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    },
    stdio: "inherit",
    windowsHide: true,
  });

  await new Promise((resolvePromise, rejectPromise) => {
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Next.js 构建被信号 ${signal} 中断。`));
        return;
      }

      resolvePromise(code ?? 1);
    });
  }).then((code) => {
    if (code !== 0) process.exitCode = code;
  });
} catch (error) {
  console.error("Next.js 生产构建未执行。", error);
  process.exitCode = 1;
}
