import os from "node:os";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const commonJsOs = require("node:os");

process.env.NODE_ENV ??= "development";
const preloadPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "patch-tsx-os.cjs",
);

const fallbackUserInfo = () => ({
  uid: -1,
  gid: -1,
  username: process.env.USERNAME || "tsx",
  homedir: process.env.USERPROFILE || process.cwd(),
  shell: process.env.ComSpec || null,
});

// 某些 Windows + Node 24 环境调用 uv_os_get_passwd 会误报 ENOMEM，
// tsx 只需要 userInfo().username 来创建临时目录，因此仅在原生调用失败时兜底。
try {
  commonJsOs.userInfo();
} catch {
  commonJsOs.userInfo = fallbackUserInfo;
  os.userInfo = fallbackUserInfo;
}

// tsx 会派生子进程执行入口，必须通过 NODE_OPTIONS 让子进程也加载兜底。
const preloadOption = `--require=${preloadPath.replaceAll("\\\\", "/")}`;
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS?.trim(), preloadOption]
  .filter(Boolean)
  .join(" ");

await import("tsx/cli");
