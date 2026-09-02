import { createHash } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

const PRODUCT_CACHE_TABLE = "cbg_product_cache";
const PRODUCT_CACHE_MAX_ENTRIES = 2_500;
const DATABASE_RETRY_DELAY_MS = 60 * 1_000;
const DATABASE_ERROR_LOG_DELAY_MS = 5 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 10 * 60 * 1_000;

type ProductCacheRow = RowDataPacket & {
  payload: Buffer;
  expires_at: number | string;
};
type ProductCacheCountRow = RowDataPacket & {
  row_count: number | string;
};

export type PersistedProductCache = {
  payload: Buffer;
  expiresAt: number;
};

const mysqlPort = Number(process.env.MYSQL_PORT ?? 3306);
const pool: Pool = mysql.createPool({
  host: process.env.MYSQL_HOST?.trim() || "127.0.0.1",
  port: Number.isFinite(mysqlPort) ? mysqlPort : 3306,
  user: process.env.MYSQL_USER?.trim() || "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE?.trim() || "yys_cbg_inspector",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 4,
  queueLimit: 0,
  enableKeepAlive: true,
});

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
    tableReady = pool
      .query(
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
  await pool.execute(`DELETE FROM ${PRODUCT_CACHE_TABLE} WHERE cache_key = ?`, [
    cacheKeyHash,
  ]);
}

async function cleanupExpiredProductCache() {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;

  await pool.execute(
    `DELETE FROM ${PRODUCT_CACHE_TABLE} WHERE expires_at <= ? LIMIT 100`,
    [now],
  );
}

async function trimProductCache() {
  const [countRows] = await pool.query<ProductCacheCountRow[]>(
    `SELECT COUNT(*) AS row_count FROM ${PRODUCT_CACHE_TABLE}`,
  );
  const excess =
    Number(countRows[0]?.row_count ?? 0) - PRODUCT_CACHE_MAX_ENTRIES;
  if (!Number.isSafeInteger(excess) || excess <= 0) return;

  await pool.query(`
    DELETE FROM ${PRODUCT_CACHE_TABLE}
    WHERE cache_key IN (
      SELECT cache_key
      FROM (
        SELECT cache_key
        FROM ${PRODUCT_CACHE_TABLE}
        ORDER BY updated_at ASC, created_at ASC, cache_key ASC
        LIMIT ${excess}
      ) AS oldest_entries
    )
  `);
}

export async function readProductCacheFromDatabase(key: string) {
  if (databaseUnavailableUntil > Date.now()) return undefined;

  try {
    await ensureProductCacheTable();
    const cacheKeyHash = getCacheKeyHash(key);
    const [rows] = await pool.execute<ProductCacheRow[]>(
      `SELECT payload, expires_at
       FROM ${PRODUCT_CACHE_TABLE}
       WHERE cache_key = ?
       LIMIT 1`,
      [cacheKeyHash],
    );
    const row = rows[0];
    if (!row) return undefined;

    const expiresAt = Number(row.expires_at);
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
    await pool.execute(
      `INSERT INTO ${PRODUCT_CACHE_TABLE} (cache_key, payload, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         payload = VALUES(payload),
         expires_at = VALUES(expires_at),
         updated_at = CURRENT_TIMESTAMP`,
      [getCacheKeyHash(key), payload, expiresAt],
    );
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
