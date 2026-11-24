// TOY 的封面（4:3，1200 × 900）和图标（1:1，500 × 500）：用雾林令牌拼一页 HTML，再用 Playwright 截图。
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";

export type CoverTool = { name: string; summary: string; iconSvg: string };
export type CoverInput = { title: string; tagline: string; tools: CoverTool[]; logoPath: string; logoViewBox: string; single: boolean };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function page(tokensCss: string, body: string, width: number, height: number): string {
  return `<!doctype html><html lang="zh-CN" data-theme="night"><head><meta charset="utf-8"><style>
${tokensCss}
html,body{margin:0}
*{box-sizing:border-box}
body{width:${width}px;height:${height}px;overflow:hidden;font-family:var(--font-sans);color:var(--on-scene);
  background:radial-gradient(90% 80% at 88% 8%, var(--forest) 0%, transparent 62%),radial-gradient(70% 60% at 0% 100%, color-mix(in srgb, var(--forest) 70%, transparent) 0%, transparent 70%),var(--ground)}
.vf{position:absolute;inset:44px;border:4px solid var(--line-strong);border-radius:36px;--l:72px;
  -webkit-mask:linear-gradient(#000 0 0) top left/var(--l) var(--l) no-repeat,linear-gradient(#000 0 0) top right/var(--l) var(--l) no-repeat,linear-gradient(#000 0 0) bottom left/var(--l) var(--l) no-repeat,linear-gradient(#000 0 0) bottom right/var(--l) var(--l) no-repeat}
.brand{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:700;letter-spacing:.02em}
.icon{display:grid;place-items:center;background:var(--sky-soft);color:var(--sky-text)}
.icon svg{width:58%;height:58%;stroke-width:1.75}
.name{margin:0;font-weight:800;letter-spacing:.02em;line-height:1.05}
.summary{margin:0;color:var(--on-scene-muted);line-height:1.5}
</style></head><body>${body}</body></html>`;
}

function logo(input: CoverInput, height: number, color: string): string {
  return `<svg viewBox="${input.logoViewBox}" height="${height}" style="color:${color}"><path fill="currentColor" fill-rule="evenodd" d="${input.logoPath}"/></svg>`;
}

function posterBody(input: CoverInput): string {
  const brand = `<div class="brand">${logo(input, 44, "var(--on-scene)")}<span>痕继痕迹</span></div>`;
  if (input.single) {
    const t = input.tools[0]!;
    return `<div class="vf"></div><div style="position:absolute;inset:108px;display:grid;align-content:space-between">
      ${brand}
      <div style="display:grid;gap:36px">
        <div class="icon" style="width:150px;height:150px;border-radius:36px">${t.iconSvg}</div>
        <h1 class="name" style="font-size:132px">${escapeHtml(t.name)}</h1>
        <p class="summary" style="font-size:40px;max-width:900px">${escapeHtml(t.summary)}</p>
      </div></div>`;
  }
  const icons = input.tools
    .slice(0, 5)
    .map((t) => `<div class="icon" style="width:112px;height:112px;border-radius:28px">${t.iconSvg}</div>`)
    .join("");
  return `<div class="vf"></div><div style="position:absolute;inset:108px;display:grid;align-content:space-between">
    ${brand}
    <div style="display:grid;gap:36px">
      <div style="display:flex;gap:24px">${icons}</div>
      <h1 class="name" style="font-size:132px">${escapeHtml(input.title)}</h1>
      <p class="summary" style="font-size:40px;max-width:900px">${escapeHtml(input.tagline)}</p>
    </div></div>`;
}

function iconBody(input: CoverInput): string {
  if (input.single) {
    return `<div class="icon" style="position:absolute;inset:0">${input.tools[0]!.iconSvg}</div>`;
  }
  return `<div style="position:absolute;inset:0;display:grid;place-items:center">${logo(input, 300, "var(--sky)")}</div>`;
}

async function launch(): Promise<Browser> {
  try {
    // 用本机装的 Chrome，省得另外下载浏览器；没有就退回 Playwright 自带的
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

export async function renderCovers(input: CoverInput, outDir: string): Promise<{ poster: string; icon: string }> {
  const tokensCss = readFileSync(join("src", "design", "tokens.css"), "utf8");
  mkdirSync(outDir, { recursive: true });
  const poster = join(outDir, "poster.png");
  const icon = join(outDir, "icon.png");
  const browser = await launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    await p.setContent(page(tokensCss, posterBody(input), 1200, 900));
    await p.screenshot({ path: poster });
    await p.setViewportSize({ width: 500, height: 500 });
    await p.setContent(page(tokensCss, iconBody(input), 500, 500));
    await p.screenshot({ path: icon });
  } finally {
    await browser.close();
  }
  return { poster, icon };
}
