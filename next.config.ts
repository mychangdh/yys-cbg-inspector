import type { NextConfig } from "next";

const apiServerUrl = (
  process.env.API_SERVER_URL || "http://127.0.0.1:3001"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
