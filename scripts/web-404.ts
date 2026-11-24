// 网站构建的收尾：React Router 把 /404 预渲染到 404/index.html，Cloudflare Pages 认的是目录里的 404.html
// （有它时找不到的地址返回 404 并显示离它最近的一级目录里的 404.html；根目录没有时 Pages 会把所有地址都当成单页应用返回首页）。
// tools/404.html 由工具路由渲染，接住 /tools/<不存在的 id>/，原因见 react-router.config.ts。
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const out = "build/client";
for (const dir of ["404", "tools/404"]) {
  const page = join(out, dir, "index.html");
  if (!existsSync(page)) {
    console.error(`没有找到 ${page}，先运行 react-router build`);
    process.exit(1);
  }
  copyFileSync(page, join(out, `${dir}.html`));
  // /404/ 本身不该是一个能打开的页面
  rmSync(join(out, dir), { recursive: true, force: true });
  console.log(`已生成 ${out}/${dir}.html`);
}
// 单页兜底文件用不到（找不到的地址由 404.html 接住）
rmSync(join(out, "__spa-fallback.html"), { force: true });
