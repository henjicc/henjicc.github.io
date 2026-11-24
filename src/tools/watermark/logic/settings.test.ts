import { describe, expect, it } from "vitest";
import { applyPosition, clampSize, FACTORY_MARK, filenameAsText, fontStack, parseMarkSettings, summarize } from "./settings";

describe("位置", () => {
  it("九宫格把位移放到对应的边", () => {
    expect(applyPosition(FACTORY_MARK, "top-left")).toMatchObject({ offsetX: -100, offsetY: 100 });
    expect(applyPosition(FACTORY_MARK, "bottom-right")).toMatchObject({ offsetX: 100, offsetY: -100 });
    expect(applyPosition({ ...FACTORY_MARK, offsetX: 40 }, "center")).toMatchObject({ offsetX: 0, offsetY: 0 });
  });
  it("平铺时转成斜的，不动位移", () => {
    expect(applyPosition({ ...FACTORY_MARK, offsetX: 12 }, "tile")).toMatchObject({ position: "tile", rotation: -30, offsetX: 12 });
  });
});

describe("读取存过的设置", () => {
  it("缺字段和坏值换成默认，超范围的夹回去", () => {
    const s = parseMarkSettings({ text: "你好", opacity: 5, color: "red", position: "nowhere", rotation: -999 });
    expect(s).toEqual({ ...FACTORY_MARK, text: "你好", opacity: 1, rotation: -180 });
  });
  it("空值也能读", () => {
    expect(parseMarkSettings(undefined)).toEqual(FACTORY_MARK);
  });
});

it("切换单位后大小夹到新范围", () => {
  expect(clampSize(300, "percent")).toBe(100);
  expect(clampSize(2, "px")).toBe(8);
});

it("文件名去掉扩展名作水印", () => {
  expect(filenameAsText("旅行 01.final.JPG")).toBe("旅行 01.final");
  expect(filenameAsText(".hidden")).toBe(".hidden");
});

it("本机字体排在内置回退链前面", () => {
  expect(fontStack("local:My Font")).toMatch(/^"My Font", /);
  expect(fontStack("unknown")).toBe(fontStack("hei"));
});

describe("摘要", () => {
  it("文字、位置、不透明度", () => {
    expect(summarize(FACTORY_MARK, undefined, 1)).toBe("文字 · 示例水印 · 居中 · 70%");
  });
  it("多张、平铺、图片水印", () => {
    const s = { ...applyPosition(FACTORY_MARK, "tile"), type: "image" as const };
    expect(summarize(s, "logo.png", 3)).toBe("3 张 · 图片 · logo.png · 平铺 -30° · 70%");
  });
});
