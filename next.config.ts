import type { NextConfig } from "next";

const apiServerUrl = (
  process.env.API_SERVER_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 服务器自部署时输出可独立运行的 Node.js 服务，不依赖完整 Next 开发环境。
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/yys-cbg-inspector/:path*",
        destination: `${apiServerUrl}/yys-cbg-inspector/:path*`,
      },
      {
        source: "/assets/:path*",
        destination: `${apiServerUrl}/assets/:path*`,
      },
    ];
  },
};

export default nextConfig;
