import { describe, expect, it } from "vitest";
import { createPreset, exportPresets, importPresets, PresetImportError, pruneMarks, type Mark } from "./presets";
import { FACTORY_MARK } from "./settings";

const ids = () => {
  let n = 0;
  return () => `id${++n}`;
};
const mark: Mark = { id: "m1", name: "logo.png", dataUrl: "data:image/svg+xml,%3Csvg%2F%3E", width: 40, height: 20 };

describe("预设导入导出", () => {
  it("导出再导入：设置和水印图片都在，换了新 id", () => {
    const p = createPreset("  右下角  ", { ...FACTORY_MARK, type: "image", markId: "m1", position: "bottom-right" }, "p1", new Date(0));
    const json = exportPresets([p], { m1: mark });
    const { presets, marks } = importPresets(json, ids());
    expect(presets).toHaveLength(1);
    expect(presets[0]!.name).toBe("右下角");
    expect(presets[0]!.settings).toMatchObject({ type: "image", position: "bottom-right" });
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({ name: "logo.png", dataUrl: mark.dataUrl, width: 40, height: 20 });
    expect(presets[0]!.settings.markId).toBe(marks[0]!.id);
    expect(presets[0]!.id).not.toBe("p1");
  });

  it("认旧版水印工具导出的数组", () => {
    const legacy = [
      {
        id: "1",
        name: "旧预设",
        createdAt: "2025-01-01T00:00:00.000Z",
        settings: {
          type: "image",
          text: "x",
          position: "full-screen",
          size: 12,
          rotation: -30,
          opacity: 0.5,
          color: "#000000",
          fontFamily: "Courier New",
          offsetX: 0,
          offsetY: 0,
          spacingX: 100,
          spacingY: 100,
          imageData: "data:image/svg+xml,%3Csvg%20id%3D%22b%22%2F%3E",
          imageName: "a.png",
          imageWidth: 10,
          imageHeight: 10,
        },
      },
      { name: "没有设置" },
    ];
    const { presets, marks } = importPresets(JSON.stringify(legacy), ids());
    expect(presets).toHaveLength(1);
    expect(presets[0]!.settings).toMatchObject({ position: "tile", font: "mono", opacity: 0.5, spacingX: FACTORY_MARK.spacingX });
    expect(marks[0]!.dataUrl).toBe("data:image/svg+xml,%3Csvg%20id%3D%22b%22%2F%3E");
  });

  it("旧版图片水印缺图片数据时退回文字水印", () => {
    const legacy = [{ name: "缺图", settings: { type: "image" } }];
    expect(importPresets(JSON.stringify(legacy), ids()).presets[0]!.settings.type).toBe("text");
  });

  it("读不懂的内容报错", () => {
    expect(() => importPresets("not json", ids())).toThrow(PresetImportError);
    expect(() => importPresets('{"a":1}', ids())).toThrow("不是预设文件");
    expect(() => importPresets('{"app":"henji-watermark","version":1,"presets":[{}]}', ids())).toThrow("没有能用的预设");
  });
});

it("只保留还在用的水印图片", () => {
  const all = { m1: mark, m2: { ...mark, id: "m2" } };
  expect(Object.keys(pruneMarks(all, ["m2", null]))).toEqual(["m2"]);
});
