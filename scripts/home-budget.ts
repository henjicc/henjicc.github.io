// 网站构建的收尾检查：首页首屏要下载的 JS 按 gzip 9 级压缩后合计不能超过 145 KiB（开发方案第 11 节的首页预算）。
// 超了就让构建失败，不等上线后才发现。
//   node scripts/home-budget.ts [build/client]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KIB = 145;
const out = process.argv[2] ?? "build/client";
const html = readFileSync(join(out, "index.html"), "utf8");

// 首屏会下载的 JS：<link rel="modulepreload">、<script src>，以及内联启动脚本里的 import。
// 不按“页面里出现的所有 .js 地址”去找：路由清单里列着全站每个页面的模块，大多数首页用不到。
const refs = new Set<string>();
const patterns = [
  /<link\b[^>]*rel="modulepreload"[^>]*href="(\/[^"]+\.js)"/g,
  /<script\b[^>]*src="(\/[^"]+\.js)"/g,
  /\bimport\s*(?:\(\s*|[^"';]*?)"(\/[^"]+\.js)"/g,
];
for (const re of patterns) for (const m of html.matchAll(re)) refs.add(m[1]!);
if (!refs.size) {
  console.error(`${out}/index.html 里没有找到任何 JS 引用，检查构建产物或这个脚本的匹配规则`);
  process.exit(1);
}

let total = 0;
for (const ref of refs) total += gzipSync(readFileSync(join(out, ref)), { level: 9 }).length;

const kib = total / 1024;
const line = `首页 JS：${refs.size} 个文件，gzip 后 ${kib.toFixed(1)} KiB（预算 ${BUDGET_KIB} KiB）`;
if (kib > BUDGET_KIB) {
  console.error(`${line}，超出预算`);
  process.exit(1);
}
console.log(line);
