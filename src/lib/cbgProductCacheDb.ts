import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const PRODUCT_CACHE_TABLE = "cbg_product_cache";
const PRODUCT_CACHE_MAX_ENTRIES = 2_500;
const DATABASE_RETRY_DELAY_MS = 60 * 1_000;
const DATABASE_ERROR_LOG_DELAY_MS = 5 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1_000;

export type PersistedProductCache = {
  payload: Buffer;
  expiresAt: number;
};

let tableReady: Promise<void> | undefined;
let databaseUnavailableUntil = 0;
let lastDatabaseErrorAt = 0;
let lastCleanupAt = 0;

function getCacheKeyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function reportDatabaseError(error: unknown) {
  const now = Date.now();
  databaseUnavailableUntil = now + DATABASE_RETRY_DELAY_MS;
  if (now - lastDatabaseErrorAt < DATABASE_ERROR_LOG_DELAY_MS) return;

  lastDatabaseErrorAt = now;
  console.error("[商品缓存] 数据库暂不可用，已回退到内存缓存", {
    errorCode:
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : error instanceof Error
          ? error.name
          : "UNKNOWN_ERROR",
  });
}

async function ensureProductCacheTable() {
  if (databaseUnavailableUntil > Date.now()) {
    throw new Error("商品缓存数据库暂不可用");
  }

  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `
        CREATE TABLE IF NOT EXISTS ${PRODUCT_CACHE_TABLE} (
          cache_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          payload MEDIUMBLOB NOT NULL,
          expires_at BIGINT UNSIGNED NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (cache_key),
          KEY idx_cbg_product_cache_expires_at (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      )
      .then(() => undefined)
      .catch((error) => {
        tableReady = undefined;
        reportDatabaseError(error);
        throw error;
      });
  }

  await tableReady;
}

async function deleteProductCacheRow(cacheKeyHash: string) {
  await prisma.cbgProductCache.deleteMany({
    where: { cacheKey: cacheKeyHash },
  });
}

async function cleanupExpiredProductCache() {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  const expiredRows = await prisma.cbgProductCache.findMany({
    where: { expiresAt: { lte: BigInt(now) } },
    orderBy: { expiresAt: "asc" },
    take: 100,
    select: { cacheKey: true },
  });
  if (expiredRows.length === 0) return;

  await prisma.cbgProductCache.deleteMany({
    where: { cacheKey: { in: expiredRows.map((row) => row.cacheKey) } },
  });
}

async function trimProductCache() {
  const excess =
    (await prisma.cbgProductCache.count()) - PRODUCT_CACHE_MAX_ENTRIES;
  if (!Number.isSafeInteger(excess) || excess <= 0) return;

  const oldestRows = await prisma.cbgProductCache.findMany({
    orderBy: [{ updatedAt: "asc" }, { createdAt: "asc" }, { cacheKey: "asc" }],
    take: excess,
    select: { cacheKey: true },
  });
  if (oldestRows.length === 0) return;

  await prisma.cbgProductCache.deleteMany({
    where: { cacheKey: { in: oldestRows.map((row) => row.cacheKey) } },
  });
}

export async function readProductCacheFromDatabase(key: string) {
  if (databaseUnavailableUntil > Date.now()) return undefined;

  try {
    await ensureProductCacheTable();
    const cacheKeyHash = getCacheKeyHash(key);
    const row = await prisma.cbgProductCache.findUnique({
      where: { cacheKey: cacheKeyHash },
      select: { payload: true, expiresAt: true },
    });
    if (!row) return undefined;

    const expiresAt = Number(row.expiresAt);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
      await deleteProductCacheRow(cacheKeyHash);
      return undefined;
    }

    databaseUnavailableUntil = 0;
    return {
      payload: Buffer.from(row.payload),
      expiresAt,
    } satisfies PersistedProductCache;
  } catch (error) {
    reportDatabaseError(error);
    return undefined;
  }
}

export async function writeProductCacheToDatabase(
  key: string,
  payload: Buffer,
  expiresAt: number,
) {
  if (databaseUnavailableUntil > Date.now()) return;

  try {
    await ensureProductCacheTable();
    await prisma.cbgProductCache.upsert({
      where: { cacheKey: getCacheKeyHash(key) },
      create: {
        cacheKey: getCacheKeyHash(key),
        payload,
        expiresAt: BigInt(expiresAt),
      },
      update: {
        payload,
        expiresAt: BigInt(expiresAt),
      },
    });
    databaseUnavailableUntil = 0;

    try {
      await cleanupExpiredProductCache();
    } catch (error) {
      reportDatabaseError(error);
    }
    try {
      await trimProductCache();
    } catch (error) {
      reportDatabaseError(error);
    }
  } catch (error) {
    reportDatabaseError(error);
  }
}

export async function deleteProductCacheFromDatabase(key: string) {
  if (databaseUnavailableUntil > Date.now()) return;

  try {
    await ensureProductCacheTable();
    await deleteProductCacheRow(getCacheKeyHash(key));
  } catch (error) {
    reportDatabaseError(error);
  }
}
