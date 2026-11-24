import { describe, expect, it } from "vitest";
import { planWatermark, resolveFontSize, resolveImageMarkSize, singleCenter, tileCenters, type Measure } from "./plan";
import { FACTORY_MARK, applyPosition, type MarkSettings } from "./settings";

// 假的量宽：每个字符宽度等于字号的 0.5 倍（字号从 CSS 字体串里取）
const measure: Measure = (text, font) => text.length * 0.5 * Number(/^([\d.]+)px/.exec(font)![1]);
const image = { width: 1000, height: 500 };
const base: MarkSettings = { ...FACTORY_MARK, text: "ABCD" };

describe("字号", () => {
  it("百分比：第一行宽度等于图宽的指定比例", () => {
    // 10px 时宽 20，图宽 1000、10% → 第一行要 100 宽 → 字号 50
    expect(resolveFontSize("percent", 10, 1000, 20)).toBe(50);
  });
  it("太小时不低于 8px，像素模式夹在范围内", () => {
    expect(resolveFontSize("percent", 1, 100, 200)).toBe(8);
    expect(resolveFontSize("px", 2, 1000, 20)).toBe(8);
    expect(resolveFontSize("px", 5000, 1000, 20)).toBe(800);
  });
  it("图片水印保持宽高比", () => {
    expect(resolveImageMarkSize("percent", 20, 1000, { width: 400, height: 100 })).toEqual({ width: 200, height: 50 });
    expect(resolveImageMarkSize("px", 300, 1000, { width: 400, height: 200 })).toEqual({ width: 300, height: 150 });
  });
});

describe("单个水印的位置", () => {
  it("位移 0 在正中，±100 贴边，向上为正", () => {
    expect(singleCenter(1000, 500, 100, 50, 0, 0, 0)).toEqual({ x: 500, y: 250 });
    expect(singleCenter(1000, 500, 100, 50, 0, -100, 100)).toEqual({ x: 50, y: 25 });
    expect(singleCenter(1000, 500, 100, 50, 0, 100, -100)).toEqual({ x: 950, y: 475 });
  });
  it("旋转后按外接框贴边，整个水印留在图里", () => {
    const c = singleCenter(1000, 500, 100, 100, Math.PI / 4, 100, 0);
    const half = (100 * Math.SQRT2) / 2;
    expect(c.x).toBeCloseTo(1000 - half);
  });
  it("水印比图还大时放正中", () => {
    expect(singleCenter(100, 100, 300, 20, 0, 100, 0).x).toBe(50);
  });
});

describe("平铺", () => {
  it("铺满整张图，四周多出余量", () => {
    const centers = tileCenters(1000, 500, 100, 50, 100, 100, 0, 0);
    const xs = centers.map((c) => c.x);
    const ys = centers.map((c) => c.y);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(1000);
    expect(Math.min(...ys)).toBeLessThan(0);
    expect(Math.max(...ys)).toBeGreaterThan(500);
  });
  it("间隔按水印尺寸的百分比：100% 时格子是水印的两倍", () => {
    const centers = tileCenters(1000, 500, 100, 50, 100, 100, 0, 0);
    const row = centers.filter((c) => c.y === centers[0]!.y).map((c) => c.x);
    expect(row[1]! - row[0]!).toBe(200);
  });
  it("位移再大也不会留出空白", () => {
    for (const offset of [-100, -37, 0, 55, 100]) {
      const xs = tileCenters(1000, 500, 100, 50, 50, 50, offset, offset).map((c) => c.x);
      expect(Math.min(...xs)).toBeLessThanOrEqual(0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(1000);
    }
  });
});

describe("绘制方案", () => {
  it("文字：多行按行高 1.2 排开，每行水平居中", () => {
    const plan = planWatermark({ ...base, text: "AB\nABCD" }, image, "px", measure)!;
    expect(plan.content.kind).toBe("text");
    if (plan.content.kind !== "text") return;
    expect(plan.content.fontSize).toBe(10);
    expect(plan.content.lines).toEqual([
      { text: "AB", dx: -5, dy: -6 },
      { text: "ABCD", dx: -10, dy: 6 },
    ]);
    expect(plan.box).toEqual({ width: 20, height: 24 });
    expect(plan.centers).toEqual([{ x: 500, y: 250 }]);
  });
  it("空文字、没选图片时不画", () => {
    expect(planWatermark({ ...base, text: "  " }, image, "percent", measure)).toBeNull();
    expect(planWatermark({ ...base, type: "image", markId: "m" }, image, "percent", measure, null)).toBeNull();
  });
  it("图片水印用图片宽高", () => {
    const plan = planWatermark({ ...base, type: "image", markId: "m", size: 10 }, image, "percent", measure, { width: 200, height: 100 })!;
    expect(plan.content).toEqual({ kind: "image", markId: "m", width: 100, height: 50 });
  });
  it("同一套设置在不同分辨率下按比例缩放（预览和导出一致）", () => {
    const s = applyPosition({ ...base, size: 20 }, "bottom-right");
    const big = planWatermark(s, { width: 4000, height: 2000 }, "percent", measure)!;
    const small = planWatermark(s, { width: 1000, height: 500 }, "percent", measure)!;
    expect(big.box.width / 4).toBeCloseTo(small.box.width);
    expect(big.centers[0]!.x / 4).toBeCloseTo(small.centers[0]!.x);
    expect(big.centers[0]!.y / 4).toBeCloseTo(small.centers[0]!.y);
  });
});
