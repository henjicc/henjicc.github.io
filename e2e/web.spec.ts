import { expect, test } from "./fixtures";

test("首页打开，工具箱列出随机抽取", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/痕继痕迹/);
  await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
  await page.goto("/tools/");
  await expect(page.getByRole("heading", { level: 1, name: "小工具" })).toBeVisible();
  await expect(page.getByRole("link", { name: /随机抽取/ })).toBeVisible();
});

test("切换主题后重新打开还是选过的那套", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", /.+/);
  await page.getByRole("button", { name: "切换主题" }).click();
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
  test("找不到的地址显示 404 页", async ({ page }) => {
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    await page.getByRole("link", { name: "回首页" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "痕继痕迹" })).toBeVisible();
  });
});
