import { describe, expect, it } from "vitest";
import { applyPosition, clampSize, FACTORY_APP, FACTORY_MARK, filenameAsText, fontStack, migrateOffsetsV1, parseAppSettings, parseMarkSettings, summarize } from "./settings";

describe("位置", () => {
  it("选格子时偏移归零，水印落在锚点上", () => {
    expect(applyPosition({ ...FACTORY_MARK, offsetX: 12, offsetY: -8 }, "top-left")).toMatchObject({ position: "top-left", offsetX: 0, offsetY: 0 });
    expect(applyPosition({ ...FACTORY_MARK, offsetX: 40 }, "center")).toMatchObject({ offsetX: 0, offsetY: 0 });
  });
  it("平铺时转成斜的，不动位移", () => {
    expect(applyPosition({ ...FACTORY_MARK, offsetX: 12 }, "tile")).toMatchObject({ position: "tile", rotation: -30, offsetX: 12 });
  });
});

describe("第 1 版位移换算", () => {
  it("贴边的老设置换成锚点上的 0", () => {
    expect(migrateOffsetsV1({ ...FACTORY_MARK, position: "top-left", offsetX: -100, offsetY: 100 })).toMatchObject({ offsetX: 0, offsetY: 0 });
    expect(migrateOffsetsV1({ ...FACTORY_MARK, position: "bottom-right", offsetX: 100, offsetY: -100 })).toMatchObject({ offsetX: 0, offsetY: 0 });
  });
  it("手动调过的值按新方向换算：向上为正变成向下为正", () => {
    expect(migrateOffsetsV1({ ...FACTORY_MARK, position: "center", offsetX: 40, offsetY: 20 })).toMatchObject({ offsetX: 20, offsetY: -10 });
    expect(migrateOffsetsV1({ ...FACTORY_MARK, position: "bottom-right", offsetX: 80, offsetY: -100 })).toMatchObject({ offsetX: -10, offsetY: 0 });
  });
  it("平铺只翻转垂直方向", () => {
    expect(migrateOffsetsV1({ ...FACTORY_MARK, position: "tile", offsetX: 30, offsetY: 30 })).toMatchObject({ offsetX: 30, offsetY: -30 });
  });
});

describe("读取存过的设置", () => {
  it("缺字段和坏值换成默认，超范围的夹回去", () => {
    const s = parseMarkSettings({ text: "你好", opacity: 5, color: "red", position: "nowhere", rotation: -999 });
    expect(s).toEqual({ ...FACTORY_MARK, text: "你好", opacity: 1, rotation: -180 });
  });
  it("超长的文字截断，不整段换成示例水印", () => {
    const s = parseMarkSettings({ text: "长".repeat(2500) });
    expect(s.text).toBe("长".repeat(2000));
  });
  it("空值也能读", () => {
    expect(parseMarkSettings(undefined)).toEqual(FACTORY_MARK);
    expect(parseAppSettings(null)).toEqual(FACTORY_APP);
  });
  it("应用设置里的坏值换成默认", () => {
    expect(parseAppSettings({ unit: "em", quality: 3, format: "gif", defaults: { size: 30 } })).toEqual({
      ...FACTORY_APP,
      quality: 1,
      defaults: { ...FACTORY_MARK, size: 30 },
    });
  });
  it("应用设置存进 TOY 云存储，序列化后不超过 1KB", () => {
    const json = JSON.stringify({ state: { ...FACTORY_APP, defaults: { ...FACTORY_MARK, text: "@".repeat(200), font: "local:Some Long Font Family" } }, version: 1 });
    expect(new TextEncoder().encode(json).length).toBeLessThan(1024);
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
