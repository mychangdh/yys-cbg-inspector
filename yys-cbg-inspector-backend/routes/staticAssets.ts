import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import type { URL } from "node:url";

const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const assetDirectory = path.resolve(backendDirectory, "..", "public", "assets");

const contentTypes: Record<string, string> = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sendNotFound(response: ServerResponse, allowedOrigin: string) {
  response.writeHead(404, {
    "access-control-allow-origin": allowedOrigin,
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify({ status: 0, msg: "Asset not found" }));
}

async function handleStaticAssetRequest(
  requestUrl: URL,
  response: ServerResponse,
  allowedOrigin: string,
): Promise<boolean> {
  if (!requestUrl.pathname.startsWith("/assets/")) return false;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(requestUrl.pathname.slice("/assets/".length));
  } catch {
    sendNotFound(response, allowedOrigin);
    return true;
  }

  const filePath = path.resolve(assetDirectory, relativePath);
  if (!relativePath || !filePath.startsWith(`${assetDirectory}${path.sep}`)) {
    sendNotFound(response, allowedOrigin);
    return true;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) {
      sendNotFound(response, allowedOrigin);
      return true;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "access-control-allow-origin": allowedOrigin,
      "cache-control": "public, max-age=604800",
      "content-type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(await readFile(filePath));
  } catch {
    sendNotFound(response, allowedOrigin);
  }

  return true;
}

export { handleStaticAssetRequest };
