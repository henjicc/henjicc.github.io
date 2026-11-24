// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { platform } from "~/platform";
import { deletePreset, importPresetText, savePreset } from "./actions";
import { LIBRARY_BUDGET, LibraryFullError } from "./logic/presets";
import { FACTORY_MARK } from "./logic/settings";
import { useLibrary } from "./store";

// 小的 data URL 不用重新编码，测试里不需要画布
const tinyMark = (n: number) => ({ name: `m${n}.svg`, dataUrl: `data:image/svg+xml,%3Csvg%20id%3D%22m${n}%22%2F%3E`, width: 10, height: 10 });
const presetFile = (name: string, mark: ReturnType<typeof tinyMark>) =>
  JSON.stringify({ app: "henji-watermark", version: 2, presets: [{ name, settings: { ...FACTORY_MARK, type: "image" }, mark }] });

// 直接看存储里实际有什么，不看内存里的 store
const local = platform.storage.local("watermark");
const storedNames = async () => (await local.get<{ state: { presets: { name: string }[] } }>("library"))?.state.presets.map((p) => p.name);

beforeEach(async () => {
  await local.remove("library");
  await useLibrary.persist.rehydrate();
  useLibrary.setState({ marks: {}, presets: [] });
});
afterEach(() => vi.restoreAllMocks());

describe("预设库存不下时", () => {
  it("超过整库预算：拒绝保存，内存和存储里都没有这个预设", async () => {
    const huge = { ...tinyMark(1), dataUrl: `data:image/svg+xml,%3Csvg%2F%3E${"%20".repeat(LIBRARY_BUDGET / 3)}` };
    // 已经够大的图片不会再压缩（压缩要画布），这里直接塞进库里模拟库快满了
    useLibrary.setState({ marks: { big: { id: "big", ...huge } }, presets: [{ id: "p0", name: "大图", createdAt: "", settings: { ...FACTORY_MARK, markId: "big" } }] });
    await expect(savePreset("再来一个")).rejects.toBeInstanceOf(LibraryFullError);
    expect(useLibrary.getState().presets.map((p) => p.name)).toEqual(["大图"]);
  });

  it("浏览器存储写不进去：读回来对不上，报错并退回原样", async () => {
    await savePreset("第一个");
    expect(await storedNames()).toEqual(["第一个"]);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(savePreset("第二个")).rejects.toThrow("本机存储满了");
    expect(useLibrary.getState().presets.map((p) => p.name)).toEqual(["第一个"]);
    expect(await storedNames()).toEqual(["第一个"]);
  });

  it("等写入结果时又删了别的预设：只撤掉没存上的这个，删掉的不会被放回来", async () => {
    await savePreset("第一个");
    const [first] = useLibrary.getState().presets;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const saving = savePreset("第二个");
    deletePreset(first!.id);
    await expect(saving).rejects.toThrow("本机存储满了");
    expect(useLibrary.getState().presets).toEqual([]);
  });

  it("等写入结果时又加了水印图片：撤掉没存上的预设，留下那张图片", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const saving = savePreset("没存上");
    const other = { id: "other", ...tinyMark(9) };
    useLibrary.setState((l) => ({ marks: { ...l.marks, other } }));
    await expect(saving).rejects.toThrow("本机存储满了");
    expect(useLibrary.getState().presets).toEqual([]);
    expect(useLibrary.getState().marks).toEqual({ other });
  });

  it("导入带图片的预设没存上：预设和它带来的图片都撤掉", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    await expect(importPresetText(presetFile("甲", tinyMark(1)))).rejects.toThrow("本机存储满了");
    expect(useLibrary.getState()).toMatchObject({ presets: [], marks: {} });
  });
});

it("撤销删除：撤销前水印图片已被清理，也能把图片一起放回去", async () => {
  await importPresetText(presetFile("甲", tinyMark(1)));
  const [a] = useLibrary.getState().presets;
  const markId = a!.settings.markId!;
  const undo = deletePreset(a!.id);
  // 撤销窗口里又导入了一个带图片的预设，没人用的图片（甲的）被清理掉
  await importPresetText(presetFile("乙", tinyMark(2)));
  expect(useLibrary.getState().marks[markId]).toBeUndefined();

  await undo();
  const { presets, marks } = useLibrary.getState();
  expect(presets.map((p) => p.name)).toEqual(["甲", "乙"]);
  expect(marks[markId]?.name).toBe("m1.svg");
  expect(await storedNames()).toEqual(["甲", "乙"]);
});
