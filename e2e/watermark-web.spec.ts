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

test("JPEG 导出带上原图的拍摄信息", async ({ page }) => {
  await page.goto("/tools/watermark/");
  // 画一张 JPEG，再手工插入一段最小的 EXIF（方向 6）
  const jpeg = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 100;
    c.getContext("2d")!.fillRect(0, 0, 200, 100);
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
});
