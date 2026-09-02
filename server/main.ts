import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

const desktopCorsOrigins = [
  "http://localhost:12832",
  "http://127.0.0.1:12832",
  "http://tauri.localhost",
  "tauri://localhost",
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const configuredOrigin = configService.get<string>("CORS_ORIGIN", "*");
  const configuredOrigins = configuredOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAllOrigins =
    configuredOrigins.length === 1 && configuredOrigins[0] === "*";
  const origins = allowAllOrigins
    ? ["*"]
    : Array.from(new Set([...configuredOrigins, ...desktopCorsOrigins]));

  app.setGlobalPrefix("yys-cbg-inspector");
  app.enableCors({
    origin: allowAllOrigins ? true : origins,
    methods: ["GET", "OPTIONS"],
    allowedHeaders: ["content-type"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(configService.get("PORT", 3001));
  const host = configService.get("HOST", "0.0.0.0");
  await app.listen(Number.isFinite(port) ? port : 3001, host);
  console.log(`YYS CBG API listening at http://${host}:${port}`);
}

void bootstrap();
