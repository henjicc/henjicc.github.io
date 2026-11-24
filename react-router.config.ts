import type { Config } from "@react-router/dev/config";
import { tools } from "./src/tools/registry";
import { validateRegistry } from "./src/tools/schema";

// 网站：不需要服务器，构建时把每个页面预渲染成静态 HTML（输出 build/client/，即 Cloudflare Pages 的输出目录）。
export default {
  appDirectory: "src/web",
  buildDirectory: "build",
  ssr: false,
  async prerender({ getStaticPaths }) {
    validateRegistry(tools);
    const toolPages = tools.filter((t) => t.status === "live").map((t) => `/tools/${t.id}/`);
    // /404 落在通配路由上，scripts/web-404.ts 再把它复制成 Cloudflare Pages 认的 404.html。
    return [...getStaticPaths(), ...toolPages, "/404"];
  },
} satisfies Config;
