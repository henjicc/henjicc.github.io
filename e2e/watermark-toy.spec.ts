import { expect, test } from "./fixtures";

// 假的 TOY SDK：记下存进相册的图片；云存储放在内存里（重载后由平台层的本机镜像接上）。
const FAKE_SDK = `
window.__album = [];
// 填了调用序号的那几次存相册会失败一次（模拟没给权限、存储满等）
window.__failCalls = new Set();
let calls = 0;
const cloud = {};
window.toy = {
  isSupport: async () => true,
  saveImageToAlbum: async ({ base64Data }) => {
    calls++;
    if (window.__failCalls.has(calls)) throw new Error("denied");
    window.__album.push(base64Data.slice(0, 32));
  },
  getCloudStorage: async (keys) => Object.fromEntries(keys.map((k) => [k, cloud[k]])),
  setCloudStorage: async (values) => { Object.assign(cloud, values); },
  setContainerMode: async () => {},
  navigate: async () => {},
  sharePicture: async () => {},
};
`;

test.beforeEach(async ({ page }) => {
  await page.route("**/toy-sdk.js", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_SDK }));
});

test("选图后存到相册，自己弹出提示；重载后设置还在", async ({ page }) => {
  await page.goto("index.html");
  await page.getByRole("link", { name: /水印工具/ }).click();
  await expect(page).toHaveURL(/#\/tools\/watermark$/);
  await expect(page.getByRole("button", { name: "打开图片" })).toBeEnabled();

  const base64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 480;
    c.height = 320;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#3a6";
    ctx.fillRect(0, 0, 480, 320);
    return c.toDataURL("image/png").split(",")[1]!;
  });
  await page.locator("input[type=file][multiple]").setInputFiles({ name: "相册.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") });
  await expect(page.getByRole("img", { name: "预览：相册.png" })).toBeVisible();

  await page.getByRole("button", { name: "存到相册" }).click();
  await expect(page.getByText("已存到相册")).toBeVisible();
  const album = await page.evaluate(() => (window as unknown as { __album: string[] }).__album);
  expect(album).toHaveLength(1);
  expect(album[0]).toMatch(/^data:image\/jpeg/);

  // 抽屉里改文字（存本机）和偏好（存云存储），重载后都还在
  const handle = page.getByRole("button", { name: /· \d+%/ });
  await handle.click();
  await page.getByRole("textbox", { name: "水印文字" }).fill("重载后还在");
  await page.getByRole("switch", { name: "用文件名作水印文字" }).click();
  await page.reload();
  await page.getByRole("button", { name: /重载后还在/ }).click();
  await expect(page.getByRole("textbox", { name: "水印文字" })).toHaveValue("重载后还在");
  await expect(page.getByRole("switch", { name: "用文件名作水印文字" })).toBeChecked();
});

async function syntheticPng(page: import("@playwright/test").Page, name: string, hue: number) {
  const base64 = await page.evaluate((hue) => {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 160;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = `hsl(${hue} 60% 50%)`;
    ctx.fillRect(0, 0, 240, 160);
    return c.toDataURL("image/png").split(",")[1]!;
  }, hue);
  return { name, mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

test("批量存相册有几张没存上：汇总结果，只重试没存上的", async ({ page }) => {
  await page.goto("index.html#/tools/watermark");
  await expect(page.getByRole("button", { name: "打开图片" })).toBeEnabled();
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([await syntheticPng(page, "一.png", 0), await syntheticPng(page, "二.png", 120), await syntheticPng(page, "三.png", 240)]);
  await expect(page.getByRole("list", { name: "已打开的图片" }).getByRole("button")).toHaveCount(3);

  // 第 2 次存相册失败：平台层弹出那张图让用户长按保存，第 3 张没再处理
  await page.evaluate(() => (window as unknown as { __failCalls: Set<number> }).__failCalls.add(2));
  await page.getByRole("button", { name: "多选" }).click();
  await page.getByRole("button", { name: "全选" }).click();
  await page.getByRole("button", { name: "存 3 张到相册" }).click();
  await expect(page.getByText("已存 1 张，2 张没存上")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "长按图片保存" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "重试没存上的 2 张" }).click();
  await expect(page.getByText("已存 2 张到相册")).toBeVisible();
  const album = await page.evaluate(() => (window as unknown as { __album: string[] }).__album);
  expect(album).toHaveLength(3);
});

test("重试轮里只剩最后一张又没存上：仍然只重试这一张，不把已存的再存一遍", async ({ page }) => {
  await page.goto("index.html#/tools/watermark");
  await expect(page.getByRole("button", { name: "打开图片" })).toBeEnabled();
  await page
    .locator("input[type=file][multiple]")
    .setInputFiles([await syntheticPng(page, "一.png", 0), await syntheticPng(page, "二.png", 120), await syntheticPng(page, "三.png", 240)]);
  await expect(page.getByRole("list", { name: "已打开的图片" }).getByRole("button")).toHaveCount(3);

  // 第 2 次失败（首轮存 1 张），第 4 次失败（重试轮存上第 2 张、第 3 张没存上），第 5 次失败（重试最后一张又失败）
  await page.evaluate(() => {
    const fail = (window as unknown as { __failCalls: Set<number> }).__failCalls;
    [2, 4, 5].forEach((n) => fail.add(n));
  });
  await page.getByRole("button", { name: "多选" }).click();
  await page.getByRole("button", { name: "全选" }).click();
  await page.getByRole("button", { name: "存 3 张到相册" }).click();
  await expect(page.getByText("已存 1 张，2 张没存上")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "重试没存上的 2 张" }).click();
  await expect(page.getByText("已存 1 张，1 张没存上")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "重试没存上的 1 张" }).click();
  await expect(page.getByRole("dialog", { name: "长按图片保存" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "重试没存上的 1 张" })).toBeVisible();

  await page.getByRole("button", { name: "重试没存上的 1 张" }).click();
  await expect(page.getByText("已存到相册")).toBeVisible();
  const album = await page.evaluate(() => (window as unknown as { __album: string[] }).__album);
  expect(album).toHaveLength(3);
  await expect(page.getByRole("button", { name: "存 3 张到相册" })).toBeVisible();
});
