import { access, cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const standaloneRoot = resolve(projectRoot, ".next", "standalone");

async function copyDirectory(sourceName, targetName) {
  const source = resolve(projectRoot, sourceName);
  const target = resolve(standaloneRoot, targetName);

  await access(source);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { force: true, recursive: true });
}

try {
  await access(resolve(standaloneRoot, "server.js"));
  // standalone 默认不复制这两类目录，部署前补齐后即可直接运行 server.js。
  await copyDirectory("public", "public");
  await copyDirectory(".next/static", ".next/static");
  console.log("Next standalone 产物已补齐 public 和 .next/static");
} catch (error) {
  console.error("准备 Next standalone 产物失败，请先完成 next build。", error);
  process.exitCode = 1;
}
