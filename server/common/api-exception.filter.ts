import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

type ErrorPayload = {
  message?: string | string[] | Record<string, unknown>;
};

/** 统一 NestJS 错误响应，保持现有前端依赖的 status/msg 协议。 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const requestId = status >= 500 ? randomUUID() : undefined;

    if (requestId) {
      const error =
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
              stack: exception.stack,
            }
          : { name: typeof exception, message: String(exception) };
      this.logger.error(
        JSON.stringify({
          requestId,
          status,
          method: request.method,
          path: request.path,
          error,
        }),
      );
      response.header("X-Request-Id", requestId);
    }

    response.header("Cache-Control", "no-store");
    response.status(status).json({
      status: 0,
      msg: this.resolveMessage(exceptionResponse, request),
      ...(requestId ? { requestId } : {}),
    });
  }

  private resolveMessage(payload: unknown, request: Request) {
    if (request.path.endsWith("/cbg/get_equip_detail")) {
      if (request.method === "GET" && this.isValidationPayload(payload)) {
        return "商品参数无效";
      }
      if (request.method === "GET" && this.isBadGatewayPayload(payload)) {
        return "远程数据暂时无法获取，请稍后重试";
      }
    }

    if (this.isValidationPayload(payload)) return "请求参数无效";

    if (typeof payload === "string") return payload;
    if (this.isErrorPayload(payload)) {
      if (Array.isArray(payload.message)) return payload.message.join("；");
      if (typeof payload.message === "string") return payload.message;
    }

    return "服务暂时不可用，请稍后重试";
  }

  private isValidationPayload(payload: unknown): payload is ErrorPayload {
    return (
      typeof payload === "object" &&
      payload !== null &&
      Array.isArray((payload as ErrorPayload).message)
    );
  }

  private isBadGatewayPayload(payload: unknown) {
    return (
      payload instanceof Error ||
      (typeof payload === "object" &&
        payload !== null &&
        (payload as ErrorPayload).message ===
          "远程数据暂时无法获取，请稍后重试")
    );
  }

  private isErrorPayload(payload: unknown): payload is ErrorPayload {
    return typeof payload === "object" && payload !== null;
  }
}
