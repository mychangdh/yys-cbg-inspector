import type { NextConfig } from "next";
import { APP_PUBLIC_PATH } from "./src/config/paths";

const serverActionAllowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "*")
  .map((origin) => {
    try {
      return new URL(origin).host;
    } catch {
      return origin;
    }
  });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 生产环境使用公开子目录；开发环境保持根路径，便于本地直接访问 /home。
  basePath: APP_PUBLIC_PATH || undefined,
  output: "standalone",
  // 未匹配路由使用独立 404 文档，避免把应用菜单渲染到错误页面中。
  experimental: {
    globalNotFound: true,
    // 反向代理可能让 Host 与浏览器 Origin 带不一致的端口，使用明确配置的
    // 前端来源放行 Server Actions，避免 HTTPS/非标准端口部署时被误拦截。
    serverActions: {
      allowedOrigins: serverActionAllowedOrigins,
    },
  },
};

export default nextConfig;
