import type { NextConfig } from "next";
import { APP_PUBLIC_PATH } from "./src/config/paths";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 使用 Next.js 官方 basePath 处理公开子目录，让页面、Link 和静态资源
  // 统一生成 /yys-cbg-inspector/...，刷新时不再依赖根路径 /_next/ 的代理。
  basePath: APP_PUBLIC_PATH,
  output: "standalone",
  // 未匹配路由使用独立 404 文档，避免把应用菜单渲染到错误页面中。
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
