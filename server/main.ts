import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const configuredOrigin = configService.get<string>("CORS_ORIGIN", "*");
  const origins = configuredOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("yys-cbg-inspector");
  app.enableCors({
    origin: origins.length === 1 && origins[0] === "*" ? true : origins,
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
