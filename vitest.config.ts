import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 单元测试不加载 React Router 的 Vite 插件；纯逻辑默认跑在 Node 里，要 DOM 的文件自己声明 @vitest-environment jsdom。
export default defineConfig({
  define: {
    __PLATFORM__: JSON.stringify("web"),
    __TOY_TARGET__: "null",
  },
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
