// 本地静态服务器：预览网站构建结果，或把 TOY 包挂在 /toy/<路径>/ 下模拟线上的运行路径。
//   node scripts/serve.ts build/client --port 4173
//   node scripts/serve.ts dist-toy/toolbox --base toy/test --port 4317
// 和 Cloudflare Pages 一样：目录返回 index.html，找不到的地址从所在目录往上找最近的 404.html（状态码 404）。
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const root = resolve(args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) ?? "build/client");
// --base 写成 toy/test 也行：Git Bash 会把 / 开头的参数改写成 Windows 路径
const base = `/${option("--base", "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");
const port = Number(option("--port", "4173"));

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".data": "text/x-script",
};

function nearestNotFound(urlPath: string): string | null {
  let dir = join(root, normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, ""));
  if (!dir.startsWith(root)) dir = root;
  for (;;) {
    const page = join(dir, "404.html");
    if (existsSync(page)) return page;
    if (dir === root) return null;
    dir = dirname(dir);
  }
}

function resolveFile(urlPath: string): string | null {
  const sub = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  if (sub.startsWith("..")) return null;
  const file = join(root, sub);
  if (!file.startsWith(root)) return null;
  if (existsSync(file) && statSync(file).isFile()) return file;
  const index = join(file, "index.html");
  if (existsSync(index)) return index;
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith(base)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`不在 ${base} 下：${url.pathname}`);
    return;
  }
  const file = resolveFile(url.pathname.slice(base.length - 1));
  if (file) {
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
    return;
  }
  const notFound = nearestNotFound(url.pathname.slice(base.length - 1));
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(notFound ? readFileSync(notFound) : "Not Found");
}).listen(port, () => {
  console.log(`http://localhost:${port}${base}`);
});
