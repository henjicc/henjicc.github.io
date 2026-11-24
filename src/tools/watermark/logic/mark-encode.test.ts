import { describe, expect, it } from "vitest";
import { encodeWithinBudget, hasTransparency, type EncodeMark } from "./mark-encode";

// 假的编码器：长度和质量、面积成正比，记下每次试的参数
function fakeEncoder(fullLength: number, supportsWebp = true) {
  const calls: { mime: string; quality: number; scale: number }[] = [];
  const encode: EncodeMark = (mime, quality, scale) => {
    calls.push({ mime, quality, scale });
    const actual = mime === "image/webp" && !supportsWebp ? "image/png" : mime;
    const q = actual === "image/png" ? 1 : quality;
    return `data:${actual};base64,` + "A".repeat(Math.round(fullLength * q * scale * scale));
  };
  return { encode, calls };
}

describe("水印图片编码", () => {
  it("不透明用 JPEG，够小就不再降", async () => {
    const { encode, calls } = fakeEncoder(1000);
    const r = await encodeWithinBudget(encode, true, 300_000);
    expect(r.dataUrl).toMatch(/^data:image\/jpeg/);
    expect(calls).toHaveLength(1);
  });

  it("带透明用 WebP；太大时先降质量再缩尺寸，最后不超过预算", async () => {
    const { encode, calls } = fakeEncoder(1_000_000);
    const r = await encodeWithinBudget(encode, false, 300_000);
    expect(r.dataUrl).toMatch(/^data:image\/webp/);
    expect(r.dataUrl.length).toBeLessThanOrEqual(300_000);
    expect(calls.every((c) => c.mime === "image/webp")).toBe(true);
    expect(calls.slice(0, 4).map((c) => c.scale)).toEqual([1, 1, 1, 1]);
    expect(r.scale).toBeLessThan(1);
  });

  it("浏览器编不了 WebP（给出 PNG）时直接缩尺寸", async () => {
    const { encode, calls } = fakeEncoder(1_000_000, false);
    const r = await encodeWithinBudget(encode, false, 300_000);
    expect(r.dataUrl).toMatch(/^data:image\/png/);
    expect(r.dataUrl.length).toBeLessThanOrEqual(300_000);
    expect(new Set(calls.map((c) => c.scale)).size).toBe(calls.length);
  });
});

it("认得出透明像素", () => {
  expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]))).toBe(false);
  expect(hasTransparency(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 128]))).toBe(true);
});
