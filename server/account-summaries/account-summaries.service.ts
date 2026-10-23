import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import { SaveAccountSummaryDto } from "./save-account-summary.dto";

const allowedProductHosts = new Set([
  "yys.cbg.163.com",
  "cbg.163.com",
  "yys-huawei.cbg.163.com",
  "yys-oppo.cbg.163.com",
  "yys-vivo.cbg.163.com",
  "yys-xiaomi.cbg.163.com",
]);

@Injectable()
export class AccountSummariesService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async save(input: SaveAccountSummaryDto) {
    if (
      typeof input?.productUrl !== "string" ||
      !input.productUrl.trim() ||
      input.productUrl.length > 2_048
    ) {
      throw new BadRequestException("藏宝阁商品链接无效");
    }

    let url: URL;
    try {
      url = new URL(input.productUrl.trim());
    } catch {
      throw new BadRequestException("藏宝阁商品链接无效");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !allowedProductHosts.has(url.hostname)
    ) {
      throw new BadRequestException("仅接受 HTTPS 藏宝阁商品链接");
    }

    const productUrl = url.toString();
    const canonicalUrl = new URL(productUrl);
    canonicalUrl.search = "";
    canonicalUrl.hash = "";
    const productKey = createHash("sha256")
      .update(canonicalUrl.toString())
      .digest("hex");
    if (
      typeof input.summary !== "string" ||
      !input.summary.trim() ||
      input.summary.length > 50_000
    ) {
      throw new BadRequestException("账号摘要为空或超出长度限制");
    }

    const capturedAt = new Date();

    try {
      await this.database.accountSummary.create({
        data: { productKey, productUrl, summary: input.summary, capturedAt },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }
    }

    return { saved: true };
  }
}
