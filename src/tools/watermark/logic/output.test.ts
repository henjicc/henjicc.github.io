import { expect, it } from "vitest";
import { chooseOutputFormat, fitPixels, isHeic, outputFileName, uniqueNames, zipFileName } from "./output";

it("自动格式：可能透明的出 PNG，照片出 JPEG", () => {
  expect(chooseOutputFormat("auto", "image/png", "a.png", 0.9)).toEqual({ mime: "image/png", ext: "png" });
  expect(chooseOutputFormat("auto", "image/gif", "a.gif", 0.9).ext).toBe("png");
  expect(chooseOutputFormat("auto", "image/jpeg", "a.jpg", 0.9)).toEqual({ mime: "image/jpeg", ext: "jpg", quality: 0.9 });
  expect(chooseOutputFormat("auto", "", "IMG_1.HEIC", 0.9).ext).toBe("jpg");
});

it("指定格式时按指定的出，PNG 不带质量", () => {
  expect(chooseOutputFormat("webp", "image/png", "a.png", 0.8)).toEqual({ mime: "image/webp", ext: "webp", quality: 0.8 });
  expect(chooseOutputFormat("png", "image/jpeg", "a.jpg", 0.8)).toEqual({ mime: "image/png", ext: "png" });
});

it("HEIC 按类型或后缀认", () => {
  expect(isHeic("image/heic", "x")).toBe(true);
  expect(isHeic("image/heif-sequence", "x")).toBe(true);
  expect(isHeic("", "a.heif")).toBe(true);
  expect(isHeic("image/jpeg", "a.jpg")).toBe(false);
});

it("文件名", () => {
  expect(outputFileName("山.HEIC", "jpg")).toBe("watermarked-山.jpg");
  expect(zipFileName(new Date(2026, 0, 5, 9, 3))).toBe("watermarked-20260105-0903.zip");
});

it("压缩包里重名的文件加编号", () => {
  expect(uniqueNames(["a.jpg", "A.jpg", "a.jpg", "b"])).toEqual(["a.jpg", "A (2).jpg", "a (3).jpg", "b"]);
});

it("超过画布上限时按比例缩小", () => {
  expect(fitPixels(4000, 3000, 16_777_216, 16384)).toEqual({ width: 4000, height: 3000, scale: 1 });
  const big = fitPixels(8000, 6000, 16_777_216, 16384);
  expect(big.width * big.height).toBeLessThanOrEqual(16_777_216);
  expect(big.width / big.height).toBeCloseTo(4 / 3, 2);
  expect(fitPixels(40000, 100, 1e9, 16384).width).toBe(16384);
});
