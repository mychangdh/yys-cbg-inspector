import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { pingDatabase } from "./database.ts";
import { handleCbgRequest } from "./routes/cbg.ts";
import { handleStaticAssetRequest } from "./routes/staticAssets.ts";
import { handleStaticDataRequest } from "./routes/staticData.ts";

const port = Number(process.env.PORT || 3001);
const apiPrefix = "/yys-cbg-inspector";
// 默认监听所有网卡，便于同一局域网内的浏览器访问；生产环境可通过 HOST 覆盖。
const host = process.env.HOST || "0.0.0.0";
const allowedOrigin = process.env.CORS_ORIGIN || "*";

function sendJson(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, {
    "access-control-allow-origin": allowedOrigin,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function sendError(response: ServerResponse, status: number, message: string) {
  sendJson(response, status, { status: 0, msg: message });
}

const server = http.createServer(
  async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`,
    );

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": allowedOrigin,
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      response.end();
      return;
    }

    if (request.method !== "GET") {
      sendError(response, 405, "不支持的请求方式");
      return;
    }

    try {
      // 静态图片不属于 API，继续使用独立的 /assets/ 路径。
      if (await handleStaticAssetRequest(requestUrl, response, allowedOrigin))
        return;

      if (
        requestUrl.pathname !== apiPrefix &&
        !requestUrl.pathname.startsWith(`${apiPrefix}/`)
      ) {
        sendError(response, 404, "接口不存在");
        return;
      }

      // 路由处理器仅关心内部路径，统一在入口处移除公开 API 前缀。
      requestUrl.pathname =
        requestUrl.pathname.slice(apiPrefix.length) || "/";

      if (requestUrl.pathname === "/health") {
        await pingDatabase();
        sendJson(response, 200, {
          status: 1,
          data: { service: "yys-cbg-api", database: "connected" },
        });
        return;
      }
      if (await handleStaticDataRequest(requestUrl, response, allowedOrigin))
        return;
      if (await handleCbgRequest(requestUrl, response, allowedOrigin)) return;
      sendError(response, 404, "接口不存在");
    } catch (error) {
      // 错误详情只写入服务端日志，避免把数据库、文件路径或上游信息返回给客户端。
      console.error("API request failed", error);
      sendError(response, 500, "服务暂时不可用，请稍后重试");
    }
  },
);

server.listen(port, host, () => {
  console.log(`YYS CBG API listening at http://${host}:${port}`);
});
