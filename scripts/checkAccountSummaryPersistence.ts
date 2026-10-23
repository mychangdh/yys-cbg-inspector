import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import type { DatabaseService } from "../server/database/database.service";
import { AccountSummariesService } from "../server/account-summaries/account-summaries.service";

type RecordData = {
  productKey: string;
  productUrl: string;
  summary: string;
  capturedAt: Date;
};
const calls: RecordData[] = [];
const records = new Map<string, RecordData>();
const accountSummary = {
  create: async ({ data }: { data: RecordData }) => {
    calls.push(data);
    if (records.has(data.productKey)) {
      throw new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "test" },
      );
    }
    records.set(data.productKey, data);
    return data;
  },
};
const database = {
  accountSummary,
} as unknown as DatabaseService;
const summaries = new AccountSummariesService(database);

async function main() {
  const firstUrl =
    "https://yys.cbg.163.com/equip/11/123?share=keep#listing-detail";
  const secondUrl = "https://yys.cbg.163.com/equip/11/123?source=desktop";
  const summary = "商品名称：测试账号；售价：¥1,234";

  assert.deepEqual(await summaries.save({ productUrl: firstUrl, summary }), {
    saved: true,
  });
  assert.deepEqual(
    await summaries.save({ productUrl: secondUrl, summary: "更新后的摘要" }),
    { saved: true },
  );

  assert.equal(calls[0].productUrl, firstUrl);
  assert.equal(calls[0].summary, summary);
  assert.equal(calls[0].productKey, calls[1].productKey);
  assert.equal(records.size, 1);
  assert.equal(records.get(calls[0].productKey)?.summary, summary);

  const databaseError = new Error("database unavailable");
  accountSummary.create = async () => {
    throw databaseError;
  };
  await assert.rejects(
    summaries.save({
      productUrl: "https://yys.cbg.163.com/equip/11/456",
      summary,
    }),
    (error) => error === databaseError,
  );
  await assert.rejects(
    summaries.save({} as Parameters<typeof summaries.save>[0]),
    /藏宝阁商品链接无效/,
  );
  await assert.rejects(
    summaries.save({
      productUrl: "https://user:pass@yys.cbg.163.com/equip/11/123",
      summary,
    }),
    /仅接受 HTTPS 藏宝阁商品链接/,
  );
  await assert.rejects(
    summaries.save({
      productUrl: "https://example.com/equip/11/123",
      summary,
    }),
    /仅接受 HTTPS 藏宝阁商品链接/,
  );
  await assert.rejects(
    summaries.save({ productUrl: firstUrl, summary: "   " }),
    /账号摘要为空或超出长度限制/,
  );

  console.log("账号摘要写入自检通过");
}

void main();
