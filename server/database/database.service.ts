import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

type QueryValue = string | number | boolean | Date | null | undefined;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    const port = Number(configService.get("MYSQL_PORT", 3306));
    this.pool = mysql.createPool({
      host: configService.get("MYSQL_HOST", "127.0.0.1"),
      port: Number.isFinite(port) ? port : 3306,
      user: configService.get("MYSQL_USER", "root"),
      password: configService.get("MYSQL_PASSWORD", ""),
      database: configService.get("MYSQL_DATABASE", "yys_cbg_inspector"),
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
    });
  }

  async queryRows<T extends RowDataPacket[]>(
    sql: string,
    values: QueryValue[] = [],
  ) {
    const [rows] = await this.pool.query<T>(sql, values);
    return rows;
  }

  async ping() {
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
