import type { ServerResponse } from "node:http";
import type { URL } from "node:url";

function sendJson(
  response: ServerResponse,
  status: number,
  data: unknown,
  allowedOrigin: string,
) {
  response.writeHead(status, {
    "access-control-allow-origin": allowedOrigin,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(data));
}

function sendError(
  response: ServerResponse,
  status: number,
  message: string,
  allowedOrigin: string,
) {
  sendJson(response, status, { status: 0, msg: message }, allowedOrigin);
}

async function handleCbgRequest(
  requestUrl: URL,
  response: ServerResponse,
  allowedOrigin: string,
): Promise<boolean> {
  if (requestUrl.pathname !== "/cbg/get_equip_detail") return false;

  const serverid = requestUrl.searchParams.get("serverid");
  const ordersn = requestUrl.searchParams.get("ordersn");
  if (!/^\d+$/.test(serverid || "") || !ordersn) {
    sendJson(response, 400, { status: 0, msg: "商品参数无效" }, allowedOrigin);
    return true;
  }

  const target = `https://yys.cbg.163.com/cgi/api/get_equip_detail?serverid=${encodeURIComponent(serverid || "")}&ordersn=${encodeURIComponent(ordersn)}`;
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "user-agent": "YYS-CBG-Inspector/1.0",
        referer: "https://yys.cbg.163.com/",
      },
    });
  } catch (error) {
    console.error("CBG upstream request failed", error);
    sendError(response, 502, "商品数据暂时无法获取，请稍后重试", allowedOrigin);
    return true;
  }

  if (!upstream.ok) {
    // 不透传上游错误页面或内部响应，避免暴露第三方服务细节。
    console.error("CBG upstream returned HTTP status", upstream.status);
    sendError(response, 502, "商品数据暂时无法获取，请稍后重试", allowedOrigin);
    return true;
  }

  response.writeHead(upstream.status, {
    "access-control-allow-origin": allowedOrigin,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(await upstream.text());
  return true;
}

export { handleCbgRequest };
