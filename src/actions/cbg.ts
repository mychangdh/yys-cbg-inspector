"use server";

import { returnServerError } from "next-safe-action";
import { z } from "zod";

import { actionClient } from "@/lib/safeAction";

import type { AppServerError } from "@/lib/safeAction.types";

const CBG_EQUIP_DETAIL_ENDPOINT =
  "https://yys.cbg.163.com/cgi/api/get_equip_detail";
const REQUEST_TIMEOUT_MS = 20_000;

const getEquipDetailSchema = z.object({
  serverid: z.string().trim().regex(/^\d+$/, "商品参数无效"),
  ordersn: z.string().trim().min(1, "商品参数无效"),
});

const upstreamError = {
  code: "UPSTREAM_UNAVAILABLE",
  message: "商品数据暂时无法获取，请稍后重试",
} satisfies AppServerError;

/**
 * 在 Next.js 服务端读取藏宝阁商品详情，避免浏览器直接访问外部服务。
 * 输入由 Zod 校验，预期的上游失败通过 next-safe-action 统一返回。
 */
export const getEquipDetailAction = actionClient
  .inputSchema(getEquipDetailSchema)
  .outputSchema(z.unknown())
  .action(async ({ parsedInput }) => {
    const target = new URL(CBG_EQUIP_DETAIL_ENDPOINT);
    target.searchParams.set("serverid", parsedInput.serverid);
    target.searchParams.set("ordersn", parsedInput.ordersn);

    try {
      const response = await fetch(target, {
        headers: {
          "user-agent": "YYS-CBG-Inspector/1.0",
          referer: "https://yys.cbg.163.com/",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        return returnServerError(upstreamError);
      }

      try {
        return (await response.json()) as unknown;
      } catch {
        return returnServerError(upstreamError);
      }
    } catch {
      return returnServerError(upstreamError);
    }
  });
