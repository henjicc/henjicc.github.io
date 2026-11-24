import { expect, test } from "./fixtures";

// TOY 包挂在本地的 /toy/test/ 下跑，模拟线上 /toy/<路径>/ 的运行路径。
// 官方 SDK 只在 B 站 App 里有用；这里换成空脚本，测的是 App 外没有 SDK 时的退路，也不依赖外网。
test.beforeEach(async ({ page }) => {
  await page.route("**/toy-sdk.js", (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
});

test("工具列表打开随机抽取并抽一次，重载后记录还在", async ({ page }) => {
  await page.goto("index.html");
  await expect(page).toHaveTitle("痕迹工具箱");
  await page.getByRole("link", { name: /随机抽取/ }).click();
  await expect(page).toHaveURL(/#\/tools\/random-picker$/);
  await page.getByRole("button", { name: "开始抽取" }).click();
  await page.getByRole("button", { name: "停下" }).click();
  const picked = page.getByLabel("已抽到").getByText(/\S/);
  await expect(picked).toHaveCount(1);
  // 侧滑返回会退出 TOY、回来可能整页重载：抽取记录必须已经落盘
  await page.reload();
  await expect(page.getByLabel("已抽到").getByText(/\S/)).toHaveCount(1);
});

test("?p= 深链直接打开工具页", async ({ page }) => {
  await page.goto("index.html?p=/tools/random-picker");
  await expect(page).toHaveURL(/#\/tools\/random-picker$/);
  await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible();
});

test("手机布局：抽屉展开后能改设置，点主按钮时收起", async ({ page }) => {
  await page.goto("index.html#/tools/random-picker");
  const handle = page.getByRole("button", { name: /名单 \d+ 人/ });
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await handle.click();
  await expect(handle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("switch", { name: "抽过的人不再抽到" })).toBeVisible();
  await page.getByRole("button", { name: "开始抽取" }).click();
  await expect(handle).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "停下" }).click();
});
