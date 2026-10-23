import { prisma } from "./prisma";

const COOLDOWN_MS = 24 * 60 * 60 * 1_000;
const COOLDOWN_TABLE = "cbg_upstream_cooldown";
const RISK_CONTROL_PATTERN =
  /风控|账号安全|安全验证|请登录(?:之后|后)?继续访问|请完成验证|验证码|访问频繁|请求频繁|操作频繁|请求被拦截|异常请求|访问异常|稍后再试|too many requests|rate[-_ ]?limit|forbidden|blocked|captcha|security verification/i;

let tableReady: Promise<void> | undefined;

async function ensureCooldownTable() {
  if (!tableReady) {
    tableReady = prisma
      .$executeRawUnsafe(
        `
        CREATE TABLE IF NOT EXISTS ${COOLDOWN_TABLE} (
          id TINYINT UNSIGNED NOT NULL,
          cooldown_until BIGINT UNSIGNED NOT NULL,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `,
      )
      .then(() => undefined)
      .catch((error) => {
        tableReady = undefined;
        throw error;
      });
  }

  await tableReady;
}

export function isCbgRiskControlPayload(payload: unknown, httpStatus?: number) {
  if (httpStatus === 403 || httpStatus === 429) return true;
  if (typeof payload === "object" && payload !== null) {
    const statusCode = Number(
      (payload as { status_code?: unknown }).status_code,
    );
    if (statusCode === 403 || statusCode === 429) return true;
  }

  const text =
    typeof payload === "string" ? payload : JSON.stringify(payload) || "";
  return RISK_CONTROL_PATTERN.test(text);
}

export async function getCbgUpstreamCooldownUntil() {
  await ensureCooldownTable();
  const rows = await prisma.$queryRaw<Array<{ cooldown_until: bigint }>>`
    SELECT cooldown_until
    FROM cbg_upstream_cooldown
    WHERE id = 1
  `;
  return rows.length ? Number(rows[0].cooldown_until) : 0;
}

export async function recordCbgUpstreamCooldown() {
  await ensureCooldownTable();
  const cooldownUntil = Date.now() + COOLDOWN_MS;
  await prisma.$executeRaw`
    INSERT INTO cbg_upstream_cooldown (id, cooldown_until, updated_at)
    VALUES (1, ${BigInt(cooldownUntil)}, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      cooldown_until = GREATEST(cooldown_until, VALUES(cooldown_until)),
      updated_at = CURRENT_TIMESTAMP
  `;
  return getCbgUpstreamCooldownUntil();
}

export function formatCbgUpstreamCooldownMessage(cooldownUntil: number) {
  const hours = Math.max(
    1,
    Math.ceil((cooldownUntil - Date.now()) / 3_600_000),
  );
  return `藏宝阁接口触发风控，全站查询已暂停，预计约 ${hours} 小时后恢复`;
}
