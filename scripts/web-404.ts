// 网站构建的收尾：React Router 把 /404 预渲染到 404/index.html，Cloudflare Pages 认的是根目录的 404.html
// （有它时找不到的地址返回 404 并显示它；没有它时 Pages 会把所有地址都当成单页应用返回首页）。
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const out = "build/client";
const page = join(out, "404", "index.html");
if (!existsSync(page)) {
  console.error(`没有找到 ${page}，先运行 react-router build`);
  process.exit(1);
}
copyFileSync(page, join(out, "404.html"));
// /404/ 本身不该是一个能打开的页面；单页兜底文件用不到（找不到的地址由 404.html 接住）
rmSync(join(out, "404"), { recursive: true, force: true });
rmSync(join(out, "__spa-fallback.html"), { force: true });
console.log("已生成 build/client/404.html");
