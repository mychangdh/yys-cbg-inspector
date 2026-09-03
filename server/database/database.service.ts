import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ConfigService) configService: ConfigService) {
    const configuredUrl = configService.get<string>("DATABASE_URL")?.trim();
    const port = Number(configService.get("MYSQL_PORT", 3306));
    const host = configService.get("MYSQL_HOST", "127.0.0.1");
    const user = configService.get("MYSQL_USER", "root");
    const password = configService.get("MYSQL_PASSWORD", "");
    const database = configService.get("MYSQL_DATABASE", "yys_cbg_inspector");
    const databaseUrl =
      configuredUrl ??
      `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${Number.isFinite(port) ? port : 3306}/${encodeURIComponent(database)}`;

    super({ datasourceUrl: databaseUrl });
  }

  async ping() {
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
