import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { APP_PUBLIC_PATH } from "./src/config/paths";

export function middleware(request: NextRequest) {
  const homeUrl = request.nextUrl.clone();
  homeUrl.pathname = `${APP_PUBLIC_PATH}/home`;

  return NextResponse.redirect(homeUrl);
}

export const config = {
  matcher: ["/"],
};
