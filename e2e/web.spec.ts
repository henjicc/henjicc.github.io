import { showVideos } from "../src/content/site";
import { expect, test } from "./fixtures";

test("首页打开，工具箱列出随机抽取", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/痕继痕迹/);
  await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
  await page.goto("/tools/");
  await expect(page.getByRole("heading", { level: 1, name: "小工具" })).toBeVisible();
  await expect(page.getByRole("link", { name: /随机抽取/ })).toBeVisible();
});

// B 站图床对带第三方 Referer 的请求返回 403。这里拦下封面请求（不依赖外网），核对请求里确实没有 Referer。
const COVER = "https://*.hdslb.com/bfs/archive/**";
const coverBody = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#2a3a33"/></svg>';

test.describe(() => {
  let referers: (string | undefined)[] = [];
  test.beforeEach(async ({ page }) => {
    referers = [];
    await page.route(COVER, (route) => {
      referers.push(route.request().headers()["referer"]);
      return route.fulfill({ contentType: "image/svg+xml", body: coverBody });
    });
  });

  test("首页：首屏、频道数据、最新一期和最近的视频", async ({ page }) => {
    test.skip(!showVideos, "网站暂时不显示视频");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
    await expect(page.getByText("粉丝", { exact: true })).toBeVisible();
    await expect(page.getByText("最新一期")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "最近的视频" })).toBeVisible();
    // 最新一期 + 最近 6 期
    const covers = page.locator('a[href^="https://www.bilibili.com/video/"] img');
    await expect(covers).toHaveCount(7);
    for (const img of await covers.all()) {
      await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
      await expect(img).toHaveAttribute("src", /^https:\/\/i\d\.hdslb\.com\/bfs\/archive\/.+@672w_378h_1c\.webp$/);
    }
    // 最新一期在首屏，封面要真的加载出来，而且请求不带 Referer
    await expect.poll(() => covers.first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    expect(referers.length).toBeGreaterThan(0);
    expect(referers.every((r) => r === undefined)).toBe(true);
    await page.getByRole("link", { name: /全部视频/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "作品" })).toBeVisible();
  });

  test("作品：列出全部视频，能按播放量排序", async ({ page }) => {
    test.skip(!showVideos, "网站暂时不显示视频");
    await page.goto("/works/");
    const titles = page.locator('a[href^="https://www.bilibili.com/video/"] h3');
    await expect(titles.first()).toBeVisible();
    const count = await titles.count();
    expect(count).toBeGreaterThan(6);
    await expect(page.locator('a[href^="https://www.bilibili.com/video/"] img[referrerpolicy="no-referrer"]')).toHaveCount(count);
    const newest = await titles.first().textContent();
    await page.getByRole("radio", { name: "最多播放" }).click();
    await expect(titles.first()).not.toHaveText(newest ?? "");
  });
});

test.describe("不显示视频时", () => {
  test.skip(showVideos, "只在关掉视频时检查");
  test.use({ allowDocument404: true });

  test("首页没有视频，频道数据和关注按钮还在", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
    await expect(page.getByText("粉丝", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /去 B 站看看/ })).toBeVisible();
    await expect(page.locator('a[href*="bilibili.com/video/"]')).toHaveCount(0);
    await expect(page.getByText("最新一期")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "作品" })).toHaveCount(0);
    await expect(page.locator('a[href^="/works"]')).toHaveCount(0);
  });

  test("/works/ 是 404 页，浏览器里跳过去也是", async ({ page }) => {
    const response = await page.goto("/works/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    await page.goto("/about/");
    await expect(page.getByRole("heading", { level: 1, name: "关于" })).toBeVisible();
    await page.evaluate(() => (window as unknown as { __reactRouterDataRouter: { navigate: (to: string) => Promise<void> } }).__reactRouterDataRouter.navigate("/works/"));
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

test("关于：介绍和各平台主页", async ({ page }) => {
  await page.goto("/about/");
  await expect(page.getByRole("heading", { level: 1, name: "关于" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "关注我" })).toBeVisible();
  for (const name of ["哔哩哔哩", "YouTube", "小红书", "抖音"]) {
    await expect(page.getByRole("main").getByRole("link", { name })).toBeVisible();
  }
});

test("切换主题后重新打开还是选过的那套", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  // 手机顶栏没有主题按钮，主题切换在菜单里
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await page.getByRole("button", { name: "菜单" }).click();
    await page.getByRole("button", { name: "切换到夜雾" }).click();
  } else {
    await page.getByRole("button", { name: "切换主题" }).click();
  }
  await expect(html).toHaveAttribute("data-theme", "night");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "night");
});

test("从工具箱打开随机抽取，抽一次", async ({ page }) => {
  await page.goto("/tools/");
  await page.getByRole("link", { name: /随机抽取/ }).click();
  await expect(page).toHaveURL(/\/tools\/random-picker\/$/);
  const start = page.getByRole("button", { name: "开始抽取" });
  await expect(start).toBeEnabled();
  await start.click();
  await page.getByRole("button", { name: "停下" }).click();
  const picked = page.getByLabel("已抽到").getByText(/\S/);
  await expect(picked).toHaveCount(1);
  // 空格键开始、再按一次停下；焦点在主按钮上时也只触发一次
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "停下" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(picked).toHaveCount(2);
  await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible();
});

test.describe(() => {
  test.use({ allowDocument404: true });
  // Pages 对 /tools/ 下更深的地址也返回 tools/404.html（由工具路由预渲染），浏览器里要匹配到同一条路由，
  // 否则水合失败、整页渲染两遍。/tools/nope/ 见 cutover.web.spec.ts
  for (const path of ["/tools/x/y/", "/tools/random-picker/old.html"]) {
    test(`${path} 显示 404 页，只渲染一遍`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
    });
  }

  test("找不到的地址显示 404 页", async ({ page }) => {
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    await page.getByRole("link", { name: "回首页" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
  });
});
