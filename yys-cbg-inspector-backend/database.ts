import "dotenv/config";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

const port = Number(process.env.MYSQL_PORT || 3306);

const pool: Pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number.isFinite(port) ? port : 3306,
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "yys_cbg_inspector",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

export async function queryRows<T extends RowDataPacket[]>(
  sql: string,
  values: Array<string | number | boolean | Date | null | undefined> = [],
) {
  const [rows] = await pool.query<T>(sql, values);
  return rows;
}

export async function pingDatabase() {
  await pool.query("SELECT 1");
}
