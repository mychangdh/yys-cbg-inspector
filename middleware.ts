import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_BASE_PATH } from "@/config/paths";

/**
 * 对进入 middleware 的请求补充子路径边界校验。
 *
 * basePath 外部的根路径和未知路径由 app/global-not-found.tsx 负责返回独立
 * 404；对于仍然进入 middleware 的请求，则使用原始 URL 再校验一次，避免
 * 反向代理或内部重写把应用页面暴露到未授权的路径下。
 */
export function middleware(request: NextRequest) {
  const requestedPath = new URL(request.url).pathname;

  if (
    requestedPath !== APP_BASE_PATH &&
    !requestedPath.startsWith(`${APP_BASE_PATH}/`)
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
