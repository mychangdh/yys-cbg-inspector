import { BadGatewayException, Injectable } from "@nestjs/common";

const UPSTREAM_COOLDOWN_MS = 10 * 60 * 1_000;
const UPSTREAM_RISK_CONTROL_MESSAGE = "接口触发风控，请下载 App 使用";
let upstreamCooldownUntil = 0;

function getRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return UPSTREAM_COOLDOWN_MS;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt)
    ? UPSTREAM_COOLDOWN_MS
    : Math.max(1_000, retryAt - Date.now());
}

function isRiskControlPayload(payload: unknown) {
  if (typeof payload === "object" && payload !== null) {
    const statusCode = Number(
      (payload as { status_code?: unknown }).status_code,
    );
    if (statusCode === 403 || statusCode === 429) return true;
  }

  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload) || "";
  return /风控|账号安全|安全验证|请登录(?:之后|后)?继续访问|请完成验证|验证码|访问频繁|请求频繁|操作频繁|请求被拦截|异常请求|访问异常|稍后再试|too many requests|rate[-_ ]?limit|forbidden|blocked|captcha|security verification/i.test(
    text,
  );
}

function enterUpstreamCooldown(response?: Response) {
  upstreamCooldownUntil = Math.max(
    upstreamCooldownUntil,
    Date.now() + (response ? getRetryAfterMs(response) : UPSTREAM_COOLDOWN_MS),
  );
}

@Injectable()
export class CbgService {
  async getEquipDetail(serverid: string, ordersn: string) {
    if (upstreamCooldownUntil > Date.now()) {
      throw new BadGatewayException(UPSTREAM_RISK_CONTROL_MESSAGE);
    }

    const target = new URL("https://yys.cbg.163.com/cgi/api/get_equip_detail");
    target.searchParams.set("client_type", "h5");

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: new URLSearchParams({
          serverid,
          ordersn,
          h5_device: "other",
          app_client: "other",
          exter: "direct",
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      console.error("CBG upstream request failed", error);
      throw new BadGatewayException("商品数据暂时无法获取，请稍后重试");
    }

    if (upstream.status === 403 || upstream.status === 429) {
      enterUpstreamCooldown(upstream);
      console.warn("CBG upstream rate limited; cooling down");
      throw new BadGatewayException(UPSTREAM_RISK_CONTROL_MESSAGE);
    }

    if (!upstream.ok) {
      console.error("CBG upstream returned HTTP status", upstream.status);
      throw new BadGatewayException("商品数据暂时无法获取，请稍后重试");
    }

    const responseText = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      if (isRiskControlPayload(responseText)) {
        enterUpstreamCooldown(upstream);
        throw new BadGatewayException(UPSTREAM_RISK_CONTROL_MESSAGE);
      }
      throw new BadGatewayException("商品数据暂时无法获取，请稍后重试");
    }

    if (isRiskControlPayload(payload)) {
      enterUpstreamCooldown(upstream);
      throw new BadGatewayException(UPSTREAM_RISK_CONTROL_MESSAGE);
    }

    return payload;
  }
}
