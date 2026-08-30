import { BadGatewayException, Injectable } from "@nestjs/common";

@Injectable()
export class CbgService {
  async getEquipDetail(serverid: string, ordersn: string) {
    const target =
      `https://yys.cbg.163.com/cgi/api/get_equip_detail?serverid=${encodeURIComponent(serverid)}` +
      `&ordersn=${encodeURIComponent(ordersn)}`;

    let upstream: Response;
    try {
      upstream = await fetch(target, {
        headers: {
          "user-agent": "YYS-CBG-Inspector/1.0",
          referer: "https://yys.cbg.163.com/",
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      console.error("CBG upstream request failed", error);
      throw new BadGatewayException("商品数据暂时无法获取，请稍后重试");
    }

    if (!upstream.ok) {
      console.error("CBG upstream returned HTTP status", upstream.status);
      throw new BadGatewayException("商品数据暂时无法获取，请稍后重试");
    }

    return JSON.parse(await upstream.text()) as unknown;
  }
}
