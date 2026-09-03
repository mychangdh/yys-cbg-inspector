import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envFiles = [".env", ".env.local", ".env.development", ".env.production"];

function readEnvFile(fileName) {
  const filePath = resolve(projectRoot, fileName);
  if (!existsSync(filePath)) return {};

  const values = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u);
    if (!match) continue;

    values[match[1]] = match[2].replace(/^("|')(.*)\1$/u, "$2");
  }
  return values;
}

const environment = {
  ...Object.assign({}, ...envFiles.map(readEnvFile)),
  ...process.env,
};

if (!environment.DATABASE_URL) {
  const host = String(environment.MYSQL_HOST || "127.0.0.1").trim();
  const port = Number(environment.MYSQL_PORT || 3306);
  const user = String(environment.MYSQL_USER || "root");
  const password = String(environment.MYSQL_PASSWORD || "");
  const database = String(
    environment.MYSQL_DATABASE || "yys_cbg_inspector",
  ).trim();
  environment.DATABASE_URL = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${Number.isFinite(port) ? port : 3306}/${encodeURIComponent(database)}`;
}

const prismaCli = resolve(
  projectRoot,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);
const result = spawnSync(
  process.execPath,
  [prismaCli, "generate", "--schema", "prisma/schema.prisma"],
  {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  },
);

process.exitCode = result.status ?? 1;
