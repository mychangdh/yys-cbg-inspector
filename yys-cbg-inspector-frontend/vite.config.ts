import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Vite config runs in Node, so load the active .env file explicitly.
  // The empty prefix also keeps legacy lower-case keys readable during migration.
  const env = loadEnv(mode, process.cwd(), "");
  const assetServerTarget =
    env.VITE_ASSET_BASE_URL?.trim() || "http://127.0.0.1:3001";

  return {
    base: "./",
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    server: {
      host: "0.0.0.0",
      // 计算器会启动多个 Worker，禁用 HMR 可避免开发更新中途替换模块导致计算任务被销毁。
      // hmr: false,
      port: 12831,
      proxy: {
        "/yys-cbg-inspector": {
          target: "http://127.0.0.1:3001/",
          changeOrigin: true,
        },
        "/assets": {
          target: assetServerTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
