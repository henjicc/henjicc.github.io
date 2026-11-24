import { expect, test } from "./fixtures";

// 假的 TOY SDK：记下存进相册的图片；云存储放在内存里（重载后由平台层的本机镜像接上）。
const FAKE_SDK = `
window.__album = [];
const cloud = {};
window.toy = {
  isSupport: async () => true,
  saveImageToAlbum: async ({ base64Data }) => { window.__album.push(base64Data.slice(0, 32)); },
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
