import { BadGatewayException, Injectable } from "@nestjs/common";
import {
  formatCbgUpstreamCooldownMessage,
  getCbgUpstreamCooldownUntil,
  isCbgRiskControlPayload,
  recordCbgUpstreamCooldown,
} from "../../src/lib/cbgUpstreamCooldown";
import type { CbgChannel } from "./get-equip-detail.query";

type CbgUpstreamEndpoint = { api: string; referer: string };

const upstreamEndpoints: Record<CbgChannel, CbgUpstreamEndpoint> = {
  official: {
    api: "https://yys.cbg.163.com/cgi/api/get_equip_detail",
    referer: "https://yys.cbg.163.com/",
  },
  huawei: {
    api: "https://yys-huawei.cbg.163.com/cgi/api/get_equip_detail",
    referer: "https://yys-huawei.cbg.163.com/",
  },
  oppo: {
    api: "https://yys-oppo.cbg.163.com/cgi/api/get_equip_detail",
    referer: "https://yys-oppo.cbg.163.com/",
  },
  vivo: {
    api: "https://yys-vivo.cbg.163.com/cgi/api/get_equip_detail",
    referer: "https://yys-vivo.cbg.163.com/",
  },
  xiaomi: {
    api: "https://yys-xiaomi.cbg.163.com/cgi/api/get_equip_detail",
    referer: "https://yys-xiaomi.cbg.163.com/",
  },
};

@Injectable()
export class CbgService {
  async getEquipDetail(
    serverid: string,
    ordersn: string,
    channel: CbgChannel = "official",
  ) {
    let cooldownUntil: number;
    try {
      cooldownUntil = await getCbgUpstreamCooldownUntil();
    } catch (error) {
      console.error("CBG cooldown state unavailable", error);
      throw new BadGatewayException(
        "接口状态暂时无法确认，查询已暂停，请稍后重试",
      );
    }
    if (cooldownUntil > Date.now()) {
      throw new BadGatewayException(
        formatCbgUpstreamCooldownMessage(cooldownUntil),
      );
    }

    const { api, referer } = upstreamEndpoints[channel];
    const target = new URL(api);
    target.searchParams.set("client_type", "h5");

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          referer,
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
      throw new BadGatewayException("远程数据暂时无法获取，请稍后重试");
    }

    const responseText = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      if (isCbgRiskControlPayload(responseText, upstream.status)) {
        const until = await recordCbgUpstreamCooldown();
        throw new BadGatewayException(formatCbgUpstreamCooldownMessage(until));
      }
      if (!upstream.ok) {
        console.error("CBG upstream returned HTTP status", upstream.status);
      }
      throw new BadGatewayException("远程数据暂时无法获取，请稍后重试");
    }

    if (isCbgRiskControlPayload(payload, upstream.status)) {
      const until = await recordCbgUpstreamCooldown();
      throw new BadGatewayException(formatCbgUpstreamCooldownMessage(until));
    }
    if (!upstream.ok) {
      console.error("CBG upstream returned HTTP status", upstream.status);
      throw new BadGatewayException("远程数据暂时无法获取，请稍后重试");
    }

    return payload;
  }
}
