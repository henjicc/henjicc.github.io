import type { Config } from "@react-router/dev/config";
import { readFileSync } from "node:fs";
import { videosFileSchema } from "./src/content/schema";
import { tools } from "./src/tools/registry";
import { validateRegistry } from "./src/tools/schema";

// 视频快照坏了就让构建失败；数据超过 7 天说明定时更新或构建机拉取可能坏了，只提醒
function checkVideos() {
  const file = videosFileSchema.parse(JSON.parse(readFileSync(new URL("./src/content/videos.json", import.meta.url), "utf8")));
  const days = (Date.now() - Date.parse(file.fetchedAt)) / 86_400_000;
  if (days > 7) console.warn(`[fetch-videos] 视频数据已经 ${Math.floor(days)} 天没更新（拉取于 ${file.fetchedAt}）`);
}

// 网站：不需要服务器，构建时把每个页面预渲染成静态 HTML（输出 build/client/，即 Cloudflare Pages 的输出目录）。
export default {
  appDirectory: "src/web",
  buildDirectory: "build",
  ssr: false,
  async prerender({ getStaticPaths }) {
    validateRegistry(tools);
    checkVideos();
    const toolPages = tools.filter((t) => t.status === "live").map((t) => `/tools/${t.id}/`);
    // /404 落在通配路由上，scripts/web-404.ts 再把它复制成 Cloudflare Pages 认的 404.html。
    // /tools/404 落在工具路由上（显示“找不到”），复制成 tools/404.html：Pages 对找不到的地址返回最近一级目录的 404.html，
    // /tools/<不存在的 id>/ 在浏览器里匹配的也是工具路由，两边对得上才不会水合失败、把页面渲染两遍。
    // 站内链接都带结尾斜杠（/works/），客户端跳转时取的数据文件是 /works/_.data；按同样的写法预渲染才会生成它
    const pages = getStaticPaths().map((p) => (p.endsWith("/") ? p : `${p}/`));
    return [...pages, ...toolPages, "/404", "/tools/404"];
  },
} satisfies Config;
