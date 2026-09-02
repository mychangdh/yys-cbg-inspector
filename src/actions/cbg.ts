"use server";

import { returnServerError } from "next-safe-action";
import { gunzipSync, gzipSync } from "node:zlib";
import { z } from "zod";

import { actionClient } from "@/lib/safeAction";
import {
  deserializeProductCache,
  serializeProductCache,
} from "@/lib/cbgProductCache";
import {
  deleteProductCacheFromDatabase,
  readProductCacheFromDatabase,
  writeProductCacheToDatabase,
} from "@/lib/cbgProductCacheDb";
import { convertCbgPayloadToDataset } from "@/lib/relics";

import type { AppServerError } from "@/lib/safeAction.types";
import type { RelicDataset, RelicSuitConfig } from "@/types";

const CBG_EQUIP_DETAIL_ENDPOINT =
  "https://yys.cbg.163.com/cgi/api/get_equip_detail";
const REQUEST_TIMEOUT_MS = 20_000;
const PRODUCT_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1_000;
const PRODUCT_CACHE_MAX_ENTRIES = 8;
const STATIC_DATA_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const UPSTREAM_COOLDOWN_MS = 10 * 60 * 1_000;
const UPSTREAM_RISK_CONTROL_MESSAGE = "接口触发风控，请下载 App 使用";

type ProductCacheEntry = {
  value: Buffer;
  expiresAt: number;
};

const productCache = new Map<string, ProductCacheEntry>();
const productRequests = new Map<string, Promise<RelicDataset>>();
let relicSuitConfigCache:
  { value: RelicSuitConfig; expiresAt: number } | undefined;
let relicSuitConfigRequest: Promise<RelicSuitConfig> | undefined;
let upstreamCooldownUntil = 0;

class UpstreamRiskControlError extends Error {}

const getEquipDetailSchema = z.object({
  serverid: z.string().trim().regex(/^\d+$/, "商品参数无效"),
  ordersn: z.string().trim().min(1, "商品参数无效"),
});

const upstreamError = {
  code: "UPSTREAM_UNAVAILABLE",
  message: "远程数据暂时无法获取，请稍后重试",
} satisfies AppServerError;
const upstreamRiskControlError = {
  code: "UPSTREAM_RISK_CONTROL",
  message: UPSTREAM_RISK_CONTROL_MESSAGE,
} satisfies AppServerError;

function getProductCacheKey(serverid: string, ordersn: string) {
  return `${serverid}\u0000${ordersn}`;
}

function readProductCache(key: string) {
  const entry = productCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    productCache.delete(key);
    return undefined;
  }

  let value: RelicDataset;
  try {
    value = deserializeProductCache(gunzipSync(entry.value));
  } catch {
    productCache.delete(key);
    return undefined;
  }

  // Map 的尾部作为最近使用项，过满时优先淘汰最早访问的商品。
  productCache.delete(key);
  productCache.set(key, entry);
  return value;
}

function writeMemoryProductCache(
  key: string,
  payload: Buffer,
  expiresAt: number,
) {
  productCache.delete(key);
  while (productCache.size >= PRODUCT_CACHE_MAX_ENTRIES) {
    const oldestKey = productCache.keys().next().value;
    if (typeof oldestKey !== "string") break;
    productCache.delete(oldestKey);
  }
  productCache.set(key, { value: payload, expiresAt });
}

function writeProductCache(key: string, value: RelicDataset) {
  const expiresAt = Date.now() + PRODUCT_CACHE_TTL_MS;
  const payload = gzipSync(serializeProductCache(value));
  writeMemoryProductCache(key, payload, expiresAt);
  void writeProductCacheToDatabase(key, payload, expiresAt);
}

function restoreProductCache(
  key: string,
  persisted: { payload: Buffer; expiresAt: number },
) {
  try {
    const value = deserializeProductCache(gunzipSync(persisted.payload));
    writeMemoryProductCache(key, persisted.payload, persisted.expiresAt);
    return value;
  } catch {
    void deleteProductCacheFromDatabase(key);
    return undefined;
  }
}

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

function getApiUrl(path: string) {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!apiBaseUrl) throw new Error("缺少接口地址配置");

  return new URL(`${path.replace(/^\/+/, "")}/`, `${apiBaseUrl}/`).toString();
}

async function loadRelicSuitConfig() {
  if (relicSuitConfigCache && relicSuitConfigCache.expiresAt > Date.now()) {
    return relicSuitConfigCache.value;
  }

  if (relicSuitConfigRequest) return relicSuitConfigRequest;

  const request = fetch(getApiUrl("static/relic-suits"), {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`静态资料接口 HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        yuhun_list?: unknown;
        two_suit_yuhun?: unknown;
      };
      if (
        !Array.isArray(payload.yuhun_list) ||
        payload.yuhun_list.length === 0 ||
        !payload.two_suit_yuhun ||
        typeof payload.two_suit_yuhun !== "object" ||
        Array.isArray(payload.two_suit_yuhun)
      ) {
        throw new Error("静态御魂资料为空或格式无效");
      }

      const value: RelicSuitConfig = {
        two_suit_yuhun: payload.two_suit_yuhun as Record<string, unknown>,
      };
      relicSuitConfigCache = {
        value,
        expiresAt: Date.now() + STATIC_DATA_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      relicSuitConfigRequest = undefined;
    });

  relicSuitConfigRequest = request;
  return request;
}

async function requestProductDetail(
  serverid: string,
  ordersn: string,
): Promise<RelicDataset> {
  if (upstreamCooldownUntil > Date.now()) {
    throw new UpstreamRiskControlError(UPSTREAM_RISK_CONTROL_MESSAGE);
  }

  const target = new URL(CBG_EQUIP_DETAIL_ENDPOINT);
  target.searchParams.set("client_type", "h5");

  const response = await fetch(target, {
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
    // 禁用 Next fetch 自带缓存，使用内存和数据库缓存。
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (response.status === 403 || response.status === 429) {
    enterUpstreamCooldown(response);
    throw new UpstreamRiskControlError(UPSTREAM_RISK_CONTROL_MESSAGE);
  }

  if (!response.ok) throw new Error(`CBG upstream HTTP ${response.status}`);

  const responseText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    if (isRiskControlPayload(responseText)) {
      enterUpstreamCooldown(response);
      throw new UpstreamRiskControlError(UPSTREAM_RISK_CONTROL_MESSAGE);
    }
    throw new Error("CBG upstream returned invalid JSON");
  }

  if (isRiskControlPayload(payload)) {
    enterUpstreamCooldown(response);
    throw new UpstreamRiskControlError(UPSTREAM_RISK_CONTROL_MESSAGE);
  }

  // 原始响应只用于本次转换，缓存和 Server Action 返回值都不再保留 equip_desc。
  const relicSuitConfig = await loadRelicSuitConfig();
  return convertCbgPayloadToDataset(payload, relicSuitConfig, {
    // 强化阶段可以由 growthRolls 在详情弹窗打开时现算，不在每个御魂上重复缓存。
    includeEnhancementStages: false,
  });
}

async function loadProductDetail(
  serverid: string,
  ordersn: string,
): Promise<RelicDataset> {
  const key = getProductCacheKey(serverid, ordersn);
  const cached = readProductCache(key);
  if (cached !== undefined) return cached;

  const pending = productRequests.get(key);
  if (pending) return pending;

  const request = (async () => {
    const persisted = await readProductCacheFromDatabase(key);
    if (persisted) {
      const restored = restoreProductCache(key, persisted);
      if (restored !== undefined) return restored;
    }

    const value = await requestProductDetail(serverid, ordersn);
    // 只缓存转换后的精简数据；原始响应不会进入缓存。
    writeProductCache(key, value);
    return value;
  })().finally(() => {
    productRequests.delete(key);
  });
  productRequests.set(key, request);
  return request;
}

/**
 * 在 Next.js 服务端读取藏宝阁商品详情，避免浏览器直接访问外部服务。
 * 输入由 Zod 校验，预期的上游失败通过 next-safe-action 统一返回。
 */
export const getEquipDetailAction = actionClient
  .inputSchema(getEquipDetailSchema)
  .outputSchema(z.unknown())
  .action(async ({ parsedInput }) => {
    try {
      return await loadProductDetail(parsedInput.serverid, parsedInput.ordersn);
    } catch (error) {
      if (error instanceof UpstreamRiskControlError) {
        return returnServerError(upstreamRiskControlError);
      }
      return returnServerError(upstreamError);
    }
  });
