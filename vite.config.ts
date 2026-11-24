import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// 网站构建（React Router 框架模式，预渲染成静态页面）。TOY 包用 vite.toy.config.ts，两边共用 src/ 下的页面和组件。
export default defineConfig({
  define: {
    __PLATFORM__: JSON.stringify("web"),
    __TOY_TARGET__: "null",
  },
  resolve: {
    alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [tailwindcss(), reactRouter()],
});
