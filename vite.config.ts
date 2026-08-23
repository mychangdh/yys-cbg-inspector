import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    minify: true, // 生产环境启用压缩
    sourcemap: false, // 关闭sourcemap减少体积
    rollupOptions: {
      external: Object.keys({}),
    },
  },
  server: {
    host: "0.0.0.0",
    // 计算器会启动多个 Worker，禁用 HMR 可避免开发更新中途替换模块导致计算任务被销毁。
    // hmr: false,
    // 桌面端独占开发端口，避免与浏览器端 main 工作目录互相加载错误代码。
    port: 12832,
    strictPort: true,
  },
});
