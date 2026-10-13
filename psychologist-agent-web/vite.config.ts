import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  css: {
    // DevUI 的样式表里保留了少量历史 hack（如 *zoom），
    // 开启容错后 LightningCSS 会跳过这些规则而不是让构建失败。
    lightningcss: {
      errorRecovery: true,
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
