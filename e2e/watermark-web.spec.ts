import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// 测试图在浏览器里用画布现画（纯色块），不用真实照片
async function syntheticPng(page: Page, name: string, width: number, height: number, hue: number) {
  const base64 = await page.evaluate(
    async ({ width, height, hue }) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = `hsl(${hue} 60% 50%)`;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.fillRect(width / 4, height / 4, width / 2, height / 2);
      return c.toDataURL("image/png").split(",")[1]!;
    },
    { width, height, hue },
  );
  return { name, mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

async function openSettings(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  const handle = page.getByRole("button", { name: /· \d+%/ });
  if ((await handle.getAttribute("aria-expanded")) !== "true") await handle.click();
}

test("加文字和图片水印，单张导出 PNG，多张打包成 ZIP", async ({ page, isMobile }) => {
  await page.goto("/tools/watermark/");
  await expect(page.getByRole("button", { name: "打开图片" })).toBeEnabled();
  await expect(page.getByRole("img", { name: "预览：示例图" })).toBeVisible();

  await page.locator("input[type=file][multiple]").setInputFiles([await syntheticPng(page, "蓝色.png", 640, 400, 210), await syntheticPng(page, "橙色.png", 300, 500, 30)]);
  await expect(page.getByRole("img", { name: "预览：橙色.png" })).toBeVisible();
  await expect(page.getByRole("list", { name: "已打开的图片" }).getByRole("button")).toHaveCount(2);

  await openSettings(page, isMobile);
  await page.getByRole("textbox", { name: "水印文字" }).fill("测试水印");
  await page.getByRole("radio", { name: "右下" }).click();

  // 单张：PNG 原图按“自动”出 PNG
  const single = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出图片" }).click();
  expect((await single).suggestedFilename()).toBe("watermarked-橙色.png");
  await expect(page.getByRole("button", { name: "已导出" })).toBeVisible();

  // 图片水印
  await openSettings(page, isMobile);
  await page.getByRole("radio", { name: "图片", exact: true }).click();
  await page.locator("input[type=file][accept='image/*,.svg']").setInputFiles(await syntheticPng(page, "标志.png", 120, 60, 120));
  await expect(page.getByText("标志.png", { exact: true })).toBeVisible();

  // 全选后批量导出：网站打成一个 ZIP，每张都在里面
  await page.getByRole("img", { name: /预览/ }).click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("ControlOrMeta+a");
  const zip = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 2 张" }).click();
  const download = await zip;
  expect(download.suggestedFilename()).toMatch(/^watermarked-\d{8}-\d{4}\.zip$/);
  const files = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(files).sort()).toEqual(["watermarked-橙色.png", "watermarked-蓝色.png"]);
  for (const data of Object.values(files)) expect([...data.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
});

test("JPEG 导出带上原图的拍摄信息，像素按方向摆正", async ({ page }) => {
  await page.goto("/tools/watermark/");
  // 画一张 200 × 100 的 JPEG（左半黑、右半白），再手工插入一段最小的 EXIF（方向 6：显示时顺时针转 90°）
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 100;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 200, 100);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 100, 100);
    const bytes = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg"))).arrayBuffer());
    const tiff = [0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
    const len = tiff.length + 8;
    const app1 = [0xff, 0xe1, len >> 8, len & 255, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    return [...bytes.subarray(0, 2), ...app1, ...bytes.subarray(2)];
  });
  await page.locator("input[type=file][multiple]").setInputFiles({ name: "照片.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
  await expect(page.getByRole("img", { name: "预览：照片.jpg" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出图片" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("watermarked-照片.jpg");
  const out = await readFile((await file.path())!);
  const at = out.indexOf(Buffer.from("Exif\0\0"));
  expect(at).toBeGreaterThan(0);
  // 方向改成了 1：像素已经摆正，留着 6 会被看图软件再转一次
  expect(out.readUInt16LE(at + 6 + 8 + 2 + 8)).toBe(1);

  // 摆正后是 100 × 200 竖图，原来的左半（黑）转到了上半
  const pixels = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), { imageOrientation: "none" });
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const at = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[0]!;
    return { width: bitmap.width, height: bitmap.height, top: at(10, 10), bottom: at(10, 190) };
  }, [...out]);
  expect(pixels).toMatchObject({ width: 100, height: 200 });
  expect(pixels.top).toBeLessThan(60);
  expect(pixels.bottom).toBeGreaterThan(200);
});

test("选了图片水印却没选图时，导出前说清楚", async ({ page, isMobile }) => {
  await page.goto("/tools/watermark/");
  await page.locator("input[type=file][multiple]").setInputFiles(await syntheticPng(page, "绿色.png", 320, 200, 120));
  await expect(page.getByRole("img", { name: "预览：绿色.png" })).toBeVisible();
  await openSettings(page, isMobile);
  await page.getByRole("radio", { name: "图片", exact: true }).click();
  let downloaded = false;
  page.on("download", () => (downloaded = true));
  await page.getByRole("button", { name: "导出图片" }).click({ force: isMobile });
  await expect(page.getByText("还没选水印图片，选一张再导出")).toBeVisible();
  expect(downloaded).toBe(false);
});

test("本机存储满了时，预设不显示成已保存", async ({ page, isMobile }) => {
  await page.goto("/tools/watermark/");
  await expect(page.getByRole("button", { name: "打开图片" })).toBeEnabled();
  // 模拟存储已满：写预设库时浏览器抛出 QuotaExceededError
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.endsWith(":library")) throw new DOMException("full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await openSettings(page, isMobile);
  await page.getByRole("button", { name: "保存当前设置" }).click();
  await page.getByRole("textbox", { name: "预设名称" }).fill("满了");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText(/预设没存上：浏览器的本机存储满了/)).toBeVisible();
  await expect(page.getByText("已保存预设“满了”")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^满了/ })).toHaveCount(0);
});
