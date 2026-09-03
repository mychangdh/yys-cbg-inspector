import { PrismaClient } from "@prisma/client";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();

  const host = process.env.MYSQL_HOST?.trim() || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT ?? 3306);
  const user = process.env.MYSQL_USER?.trim() || "root";
  const password = process.env.MYSQL_PASSWORD ?? "";
  const database = process.env.MYSQL_DATABASE?.trim() || "yys_cbg_inspector";

  return `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${Number.isFinite(port) ? port : 3306}/${encodeURIComponent(database)}`;
}

const globalForPrisma = globalThis as typeof globalThis & {
  yysPrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.yysPrisma ??
  new PrismaClient({ datasourceUrl: getDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.yysPrisma = prisma;
}
