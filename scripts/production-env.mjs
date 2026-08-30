import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const API_ENV_KEY = "NEXT_PUBLIC_API_BASE_URL";
const APP_API_PATH = "/yys-cbg-inspector";

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

/**
 * 生产构建必须使用 .env.production 中的公开 API 地址。
 * 不能依赖构建机当前 shell 的同名变量，否则开发环境变量可能覆盖生产地址。
 */
export async function readProductionApiBaseUrl(projectRoot) {
  const environmentPath = resolve(projectRoot, ".env.production");
  let content;

  try {
    content = await readFile(environmentPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "ENOENT") {
        throw new Error("缺少 .env.production，无法确定生产 API 地址。");
      }
    }
    throw error;
  }

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
    !parsedUrl.port ||
    normalizedPath !== APP_API_PATH
  ) {
    throw new Error(
      `${API_ENV_KEY} 必须是带端口的 http/https 地址，并以 ${APP_API_PATH} 结尾。`,
    );
  }

  return value.replace(/\/+$/, "");
}
