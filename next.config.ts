import type { NextConfig } from "next";
import { APP_BASE_PATH } from "./src/config/paths";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 生产环境通过域名/yys-cbg-inspector/访问整个 Next.js 应用。
  basePath: APP_BASE_PATH,
  // 服务器自部署时输出可独立运行的 Node.js 服务，不依赖完整 Next 开发环境。
  output: "standalone",
  // 子路径之外的 404 使用独立文档，避免根布局把应用菜单渲染到 404 页面中。
  experimental: {
    globalNotFound: true,
  },
};

export default nextConfig;
