import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// 外壳和共享组件的交互：快捷键、焦点、Esc 分层、全屏、手机菜单、命令面板、触控尺寸和页面布局。
const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) < 768;

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("元素没有显示出来");
  return b;
}

async function openSheet(page: Page) {
  await page.locator("button[aria-expanded='false']").filter({ hasText: "设置" }).click();
  await expect(page.locator("button[aria-expanded='true']").filter({ hasText: "收起" })).toBeVisible();
}

test.describe("随机抽取的空格键", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(mobile(page), "空格快捷键是桌面键盘的事");
    await page.goto("/tools/random-picker/");
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeEnabled();
  });

  test("滚动时用鼠标点了开关，空格仍然是停下，开关不变", async ({ page }) => {
    const toggle = page.getByRole("switch", { name: "抽过的人不再抽到" });
    const before = await toggle.getAttribute("aria-checked");
    await page.getByRole("button", { name: "开始抽取" }).click();
    await toggle.click();
    const afterClick = await toggle.getAttribute("aria-checked");
    expect(afterClick).not.toBe(before);
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible();
    await expect(page.getByLabel("已抽到").getByText(/\S/)).toHaveCount(1);
    await expect(toggle).toHaveAttribute("aria-checked", afterClick!);
  });

  test("用键盘走到开关上，空格切换开关，不开始抽取", async ({ page }) => {
    const toggle = page.getByRole("switch", { name: "抽过的人不再抽到" });
    const before = await toggle.getAttribute("aria-checked");
    await page.getByRole("textbox", { name: "每行一个名字" }).focus();
    // 从名单走到开关：中间隔着“从文件导入”“清空名单”
    for (let i = 0; i < 6 && !(await toggle.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(toggle).toBeFocused();
    await page.keyboard.press("Space");
    await expect(toggle).not.toHaveAttribute("aria-checked", before!);
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible();
  });

  test("全屏用整页，顶栏收起；切换后空格直接控制抽取", async ({ page }) => {
    await page.getByRole("button", { name: "全屏" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement)).toBe(true);
    await expect(page.locator("header").first()).toBeHidden();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "停下" })).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeVisible();
    await page.getByRole("button", { name: "退出全屏" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull();
  });

  test("按住空格只触发一次，自动重复的按键也被拦下，不会滚动页面", async ({ page }) => {
    await page.evaluate(() => {
      const w = window as unknown as { repeats: boolean[] };
      w.repeats = [];
      window.addEventListener("keydown", (e) => {
        if (e.code === "Space" && e.repeat) w.repeats.push(e.defaultPrevented);
      });
    });
    await page.keyboard.down("Space");
    await expect(page.getByRole("button", { name: "停下" })).toBeVisible();
    // 已经按下时再 down 一次，Playwright 发出的是 repeat 为 true 的 keydown
    for (let i = 0; i < 3; i++) await page.keyboard.down("Space");
    await page.keyboard.up("Space");
    expect(await page.evaluate(() => (window as unknown as { repeats: boolean[] }).repeats)).toEqual([true, true, true]);
    await expect(page.getByRole("button", { name: "停下" })).toBeVisible();
  });

  test("主按钮在“开始抽取”和“停下”之间不改变宽度", async ({ page }) => {
    const start = page.getByRole("button", { name: "开始抽取" });
    const width = (await box(start)).width;
    await start.click();
    expect((await box(page.getByRole("button", { name: "停下" }))).width).toBe(width);
  });
});

test("滑块数值按 Esc 放弃输入", async ({ page }) => {
  await page.goto("/tools/watermark/");
  if (mobile(page)) await openSheet(page);
  const field = page.getByRole("textbox", { name: "旋转数值" });
  await expect(field).toBeVisible();
  const original = await field.inputValue();
  await field.click();
  await field.fill("45");
  await field.press("Escape");
  await expect(field).toHaveValue(original);
  await expect(field).not.toBeFocused();
  // 手机上这下 Esc 只取消输入，不收起抽屉
  if (mobile(page)) await expect(page.locator("button[aria-expanded='true']").filter({ hasText: "收起" })).toBeVisible();
});

test("弹窗关闭后焦点回到打开它的按钮；抽屉里弹窗的 Esc 不连抽屉一起收起", async ({ page }) => {
  await page.goto("/tools/batch-text/");
  await expect(page.getByRole("button", { name: "开始处理" })).toBeEnabled();
  if (mobile(page)) await openSheet(page);
  for (const [trigger, title] of [
    ["管理接口", "接口配置"],
    ["管理模板", "提示词模板"],
  ] as const) {
    const button = page.getByRole("button", { name: trigger });
    await button.click();
    await expect(page.getByRole("dialog", { name: title })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: title })).toBeHidden();
    await expect(button).toBeFocused();
  }
  if (mobile(page)) await expect(page.locator("button[aria-expanded='true']").filter({ hasText: "收起" })).toBeVisible();
});

test.describe("手机工具页", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!mobile(page), "抽屉只在手机布局里");
  });

  test("焦点在抽屉里时收起，焦点交给把手", async ({ page }) => {
    await page.goto("/tools/random-picker/");
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeEnabled();
    await openSheet(page);
    await page.getByRole("switch", { name: "抽过的人不再抽到" }).focus();
    await page.keyboard.press("Escape");
    const handle = page.locator("button[aria-expanded='false']").filter({ hasText: "设置" });
    await expect(handle).toBeFocused();
  });

  test("抽屉展开时舞台内容缩到抽屉上方", async ({ page }) => {
    await page.goto("/tools/random-picker/");
    await expect(page.getByRole("button", { name: "开始抽取" })).toBeEnabled();
    const name = page.getByText("准备好了");
    const before = await box(name);
    await openSheet(page);
    // 等抽屉和舞台的动画都停下
    await expect.poll(async () => (await box(name)).height).toBeLessThan(before.height * 0.8);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    const sheetTop = (await box(page.getByRole("region", { name: "设置" }))).y;
    const after = await box(name);
    expect(after.y + after.height).toBeLessThan(sheetTop);
  });
});

test.describe("手机顶栏和菜单", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!mobile(page), "菜单只在手机顶栏里");
  });

  test("菜单开在顶栏下面，标出当前页，里面能切换主题，关掉后焦点回到菜单按钮", async ({ page }) => {
    await page.goto("/works/");
    const header = page.locator("header").first();
    // 手机顶栏只有 Logo、搜索和菜单
    await expect(header.getByRole("button", { name: "切换主题" })).toBeHidden();
    const menuButton = header.getByRole("button", { name: "菜单" });
    await menuButton.click();
    const menu = page.getByRole("dialog", { name: "菜单" });
    await expect(menu).toBeVisible();
    expect((await box(menu)).y).toBeGreaterThanOrEqual((await box(header)).y + (await box(header)).height - 1);
    // 菜单开着时 Radix 把页面其余部分对读屏隐藏，按属性找
    await expect(header.locator("button[aria-label='关闭菜单']")).toBeVisible();
    await expect(menu.getByRole("link", { name: "作品" })).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "关于" })).not.toHaveAttribute("aria-current", /.+/);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    const html = page.locator("html");
    const theme = await html.getAttribute("data-theme");
    await menuButton.click();
    await menu.getByRole("button", { name: /切换到/ }).click();
    await expect(html).not.toHaveAttribute("data-theme", theme ?? "__none__");
  });

  test("可点的东西不小于 44×44", async ({ page }) => {
    await page.goto("/works/");
    const targets = [
      page.locator("header").first().getByRole("button", { name: "搜索" }),
      page.locator("header").first().getByRole("button", { name: "菜单" }),
      page.getByRole("radio", { name: "最多播放" }),
      page.getByRole("contentinfo").getByRole("link").first(),
    ];
    for (const t of targets) {
      const b = await box(t);
      expect(b.height, (await t.textContent()) ?? undefined).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
  });
});

test("命令面板：视频分组；1440×900 下不用滚动就能看到“关于”；关掉后焦点回到搜索按钮", async ({ page }) => {
  test.skip(mobile(page), "按桌面尺寸核对");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const search = page.locator("header").getByRole("button", { name: /搜索/ }).first();
  await search.click();
  const dialog = page.getByRole("dialog", { name: "搜索" });
  await expect(dialog.getByText("视频", { exact: true })).toBeVisible();
  const about = dialog.getByRole("option", { name: "关于" });
  const list = dialog.getByRole("listbox");
  const a = await box(about);
  const l = await box(list);
  expect(a.y + a.height).toBeLessThanOrEqual(l.y + l.height);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(search).toBeFocused();
});

test("工具页脚写明文件去哪", async ({ page }) => {
  await page.goto("/tools/random-picker/");
  await expect(page.getByText("处理都在你的浏览器里，文件不会上传")).toHaveCount(1);
  await page.goto("/tools/batch-text/");
  await expect(page.getByText("文件内容会发送到你配置的接口")).toHaveCount(1);
  await expect(page.getByText("处理都在你的浏览器里，文件不会上传")).toHaveCount(0);
});

test("短页面的页脚贴在底部", async ({ page }) => {
  await page.goto("/about/");
  const footer = await box(page.getByRole("contentinfo"));
  const height = page.viewportSize()!.height;
  test.skip((await page.evaluate(() => document.documentElement.scrollHeight)) > height, "这个尺寸下页面本来就超过一屏");
  expect(footer.y + footer.height).toBeCloseTo(height, 0);
});

test.describe(() => {
  test.use({ allowDocument404: true });
  test("404 正好一屏，不滚动", async ({ page }) => {
    await page.goto("/no-such-page/");
    await expect(page.getByRole("heading", { name: "这里起雾了" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  });
});

test("theme-color 跟着当前主题", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/tools/");
  const meta = page.locator('meta[name="theme-color"]');
  const ground = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ground").trim());
  const night = await ground();
  await expect(meta).toHaveAttribute("content", night);
  if (mobile(page)) {
    await page.getByRole("button", { name: "菜单" }).click();
    await page.getByRole("button", { name: /切换到/ }).click();
  } else {
    await page.getByRole("button", { name: "切换主题" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dawn");
  const dawn = await ground();
  expect(dawn).not.toBe(night);
  await expect(meta).toHaveAttribute("content", dawn);
});

test("手机上软键盘弹出时，贴底的对话框跟着可见区域上移，正在填的输入框不被挡住", async ({ page }) => {
  test.skip(!mobile(page), "贴底的对话框只在手机上");
  await page.goto("/tools/batch-text/");
  // 安卓 Chrome 只有声明了 resizes-content，弹出键盘时才缩小布局视口；这里用缩小视口来模拟键盘
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /interactive-widget=resizes-content/);
  await expect(page.getByRole("button", { name: "开始处理" })).toBeEnabled();
  await openSheet(page);
  await page.getByRole("button", { name: "管理接口" }).click();
  const dialog = page.getByRole("dialog", { name: "接口配置" });
  await dialog.getByRole("button", { name: "编辑 默认配置" }).click();
  const field = dialog.getByLabel("模型", { exact: true });
  await field.focus();
  const size = page.viewportSize()!;
  const keyboardTop = Math.round(size.height * 0.55);
  await page.setViewportSize({ width: size.width, height: keyboardTop });
  // 浏览器在键盘弹出后会把正在填的输入框滚进可见区域；这里重新聚焦一次代替
  await field.blur();
  await field.focus();
  await expect.poll(async () => {
    const d = await box(dialog);
    return d.y + d.height;
  }).toBeLessThanOrEqual(keyboardTop + 1);
  const f = await box(field);
  expect(f.y).toBeGreaterThanOrEqual(0);
  expect(f.y + f.height).toBeLessThanOrEqual(keyboardTop);
});
