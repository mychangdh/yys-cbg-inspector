import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_ENV_KEY = "NEXT_PUBLIC_API_BASE_URL";
const APP_API_PATH = "/yys-cbg-inspector";

async function readProductionEnvironmentFile(projectRoot) {
  const environmentPath = resolve(projectRoot, ".env.production");

  try {
    return await readFile(environmentPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        throw new Error("缺少 .env.production，无法加载生产环境配置。");
      }
    }
    throw error;
  }
}

function parseEnvValue(content, key) {
  const prefix = `${key}=`;
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!line) return undefined;

  const value = line.slice(prefix.length).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function parseEnvironmentEntries(content) {
  const entries = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    const match = trimmedLine.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/,
    );
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();
    entries[key] =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
        ? value.slice(1, -1).trim()
        : value;
  }

  return entries;
}

/**
 * 生产服务固定加载 .env.production，并覆盖同名外部变量。
 * 这样宝塔、shell 或云主机预置的开发配置不会悄悄替换生产配置。
 */
export async function loadProductionEnvironment(projectRoot) {
  const content = await readProductionEnvironmentFile(projectRoot);
  const entries = parseEnvironmentEntries(content);

  for (const [key, value] of Object.entries(entries)) {
    process.env[key] = value;
  }
  process.env.NODE_ENV = "production";

  return entries;
}

/**
 * 生产构建必须使用 .env.production 中的公开 API 地址。
 * 不能依赖构建机当前 shell 的同名变量，否则开发环境变量可能覆盖生产地址。
 */
export async function readProductionApiBaseUrl(projectRoot) {
  const content = await readProductionEnvironmentFile(projectRoot);

  const value = parseEnvValue(content, API_ENV_KEY);
  if (!value) {
    throw new Error(
      `.env.production 未配置 ${API_ENV_KEY}，无法生成生产部署包。`,
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${API_ENV_KEY} 不是有效的绝对 URL。`);
  }

  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");
  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    normalizedPath !== APP_API_PATH
  ) {
    throw new Error(
      `${API_ENV_KEY} 必须是 http/https 绝对 URL，并以 ${APP_API_PATH} 结尾。`,
    );
  }

  return value.replace(/\/+$/, "");
}
