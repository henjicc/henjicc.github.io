// TOY 包的发布前检查（规则来自官方使用手册和第 0 阶段实测，见 docs/development-plan.md 第 3、8 节）。
// 任何一项不过就不能上传：平台会静默过滤不在白名单里的文件，页面就会缺东西。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

export const TOY_SDK_MARK = "s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js";

/** 平台只发布这些后缀的文件，其余（.avif、.txt、.webmanifest、.map 等）会被过滤。 */
export const ALLOWED_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".json", ".wasm", ".data", ".md", ".csv", ".tsv",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
  ".woff2", ".woff", ".ttf", ".eot",
  ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm",
  ".atlas", ".ani", ".part", ".nani", ".unityweb",
]);

/** 当前账号的包体上限（以发布页显示为准）。 */
export const DEFAULT_LIMIT_MB = 140;

// 页面跑在 /toy/<路径>/ 下，以 / 开头的本地资源会指到 B 站根目录
const ROOT_PATH_PATTERNS: [RegExp, string][] = [
  [/\b(?:src|href)=["']\/(?!\/)[^"']*/g, "HTML 里的根路径引用"],
  [/url\(\s*["']?\/(?!\/)[^)"']*/g, "CSS 里的根路径引用"],
  [/["'`]\/assets\/[^"'`]*/g, "脚本里的 /assets/ 路径"],
];

export type ToyFile = { path: string; bytes: number; gzip: number };
export type ToyCheckResult = { files: ToyFile[]; bytes: number; errors: string[]; warnings: string[] };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function checkToyPackage(dir: string, limitMb = DEFAULT_LIMIT_MB): ToyCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(dir)) return { files: [], bytes: 0, errors: [`没有这个目录：${dir}`], warnings };
  const paths = walk(dir);
  const rel = (p: string) => relative(dir, p).replaceAll("\\", "/");

  const index = join(dir, "index.html");
  if (!existsSync(index)) errors.push("根目录没有 index.html");

  for (const p of paths) {
    if (!ALLOWED_EXTENSIONS.has(extname(p).toLowerCase())) errors.push(`会被平台过滤的文件：${rel(p)}`);
  }

  for (const p of paths.filter((f) => /\.(?:html?|css|js)$/i.test(f))) {
    const text = readFileSync(p, "utf8");
    for (const [re, label] of ROOT_PATH_PATTERNS) {
      for (const m of text.matchAll(re)) errors.push(`${label}：${rel(p)} → ${m[0].slice(0, 60)}`);
    }
  }

  const html = existsSync(index) ? readFileSync(index, "utf8") : "";
  if (html && !html.includes(TOY_SDK_MARK)) errors.push("index.html 没有引入 TOY SDK");
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
  if (html && (!title || title.includes("%"))) warnings.push("index.html 没有可用的 <title>，平台带不出 TOY 名称");

  const files = paths.map((p) => {
    const buf = readFileSync(p);
    return { path: rel(p), bytes: buf.length, gzip: gzipSync(buf).length };
  });
  const bytes = files.reduce((n, f) => n + f.bytes, 0);
  if (bytes > limitMb * 1024 * 1024) errors.push(`包体 ${(bytes / 1048576).toFixed(1)} MB 超过上限 ${limitMb} MB`);

  return { files, bytes, errors, warnings };
}
