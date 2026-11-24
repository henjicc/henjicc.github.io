// 切换上线相关：旧站点留下的 Service Worker、旧版随机抽取的数据、找不到的工具地址。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, extname, join, resolve } from "node:path";
import { test as base } from "@playwright/test";
import { expect, test } from "./fixtures";

test.describe(() => {
  test.use({ allowDocument404: true });
  test("不存在的工具地址显示一次 404 页，不重复渲染", async ({ page, isMobile }) => {
    const response = await page.goto("/tools/nope/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
    // 工具路由在手机上把整页交给工具外壳，不显示站点顶栏
    await expect(page.locator("header")).toHaveCount(isMobile ? 0 : 1);
  });
});

// 旧版的数据结构见 src/tools/random-picker/logic/legacy.ts；名字是编的
const LEGACY = { names: ["甲同学", "乙同学", "丙同学"], settings: { backgroundColor: "#ffffff", textColor: "#000000", fontSizeRatio: 1 } };

test("随机抽取第一次打开时接过旧版存的名单", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((data) => localStorage.setItem("namePickerData", JSON.stringify(data)), LEGACY);
  await page.goto("/tools/random-picker/");
  await expect(page.locator("#picker-names")).toHaveValue("甲同学\n乙同学\n丙同学");
  // 旧键留着不动
  expect(await page.evaluate(() => localStorage.getItem("namePickerData"))).toBe(JSON.stringify(LEGACY));
});

test("随机抽取的“清空记录”：桌面在操作栏，手机在抽屉里，底栏只留主按钮", async ({ page, isMobile }) => {
  await page.goto("/tools/random-picker/");
  await page.getByRole("button", { name: "开始抽取" }).click();
  await page.getByRole("button", { name: "停下" }).click();
  await expect(page.getByLabel("已抽到").getByText(/\S/)).toHaveCount(1);
  const clear = page.getByRole("button", { name: "清空记录" });
  if (isMobile) {
    await expect(page.locator("footer").getByRole("button")).toHaveCount(1);
    await page.getByRole("button", { name: /设置/ }).click();
  }
  await clear.click();
  await expect(page.getByLabel("已抽到").getByText(/\S/)).toHaveCount(0);
  await expect(clear).toHaveCount(0);
});

// 旧站点的随机抽取注册过缓存优先的 Service Worker（main 分支的 tools/random-picker/service-worker.js）。
// 这里先用旧文件让浏览器装上它，再把同一个地址换成新的构建结果，确认刷新后看到的是新页面、旧 Worker 已注销。
base.describe("旧 Service Worker", () => {
  base.skip(({ isMobile }) => isMobile, "和视口无关，只在桌面跑一次");

  const BUILD = resolve("build/client");
  const TYPES: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".woff2": "font/woff2",
    ".data": "text/x-script",
  };
  let mode: "old" | "new" = "old";
  let server: Server;
  let origin = "";

  function oldFile(path: string): Buffer | null {
    try {
      return execFileSync("git", ["show", `main:${path}`], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  }

  function newFile(path: string): { status: number; file: string } | null {
    const target = join(BUILD, decodeURIComponent(path));
    if (existsSync(target) && statSync(target).isFile()) return { status: 200, file: target };
    if (existsSync(join(target, "index.html"))) return { status: 200, file: join(target, "index.html") };
    for (let dir = target; dir.startsWith(BUILD); dir = dirname(dir)) {
      if (existsSync(join(dir, "404.html"))) return { status: 404, file: join(dir, "404.html") };
    }
    return null;
  }

  base.beforeAll(async () => {
    base.skip(!oldFile("tools/random-picker/service-worker.js"), "没有 main 分支的旧站点文件");
    server = createServer((req, res) => {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      if (mode === "old") {
        const body = oldFile(path.slice(1).replace(/\/$/, "/index.html"));
        // 旧站点在 Cloudflare Pages 上没有 404.html，找不到的地址按单页应用返回 200（旧 Worker 缓存的几个图标就不存在）
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "text/html; charset=utf-8" });
        res.end(body ?? "<!doctype html><title>旧站点</title>");
        return;
      }
      const hit = newFile(path);
      res.writeHead(hit?.status ?? 404, { "content-type": TYPES[extname(hit?.file ?? "")] ?? "text/plain" });
      res.end(hit ? readFileSync(hit.file) : "Not Found");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  base.afterAll(async () => {
    await new Promise((done) => server?.close(done));
  });

  base("老访客刷新后看到新页面，旧 Worker 和缓存都清掉", async ({ context }) => {
    // 旧 Worker 安装时要缓存一个 CDN 脚本，不依赖外网
    await context.route("https://cdn.jsdelivr.net/**", (route) =>
      route.fulfill({ contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: "window.confetti = () => {};" }),
    );
    const page = await context.newPage();
    mode = "old";
    await page.goto(`${origin}/tools/random-picker/`);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect(page.locator("#settingsButton")).toBeVisible();
    expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);

    mode = "new";
    // 旧 Worker 先从缓存返回旧页面，浏览器同时去取新的 Worker 脚本，新脚本接管后清缓存、注销、重新加载页面
    await page.reload();
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#settingsButton")).toHaveCount(0);
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).length)).toBe(0);
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  });
});
