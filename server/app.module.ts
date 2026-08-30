import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import path from "node:path";
import { CbgModule } from "./cbg/cbg.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { StaticDataModule } from "./static-data/static-data.module";

const runtimeEnvironment =
  process.env.NODE_ENV?.trim() === "production" ? "production" : "development";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${runtimeEnvironment}`, ".env"],
    }),
    ServeStaticModule.forRoot({
      rootPath: path.resolve(process.cwd(), "public/assets"),
      serveRoot: "/assets",
      serveStaticOptions: { maxAge: "7d" },
    }),
    DatabaseModule,
    HealthModule,
    StaticDataModule,
    CbgModule,
  ],
})
export class AppModule {}
