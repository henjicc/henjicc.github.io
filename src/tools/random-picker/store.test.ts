// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readLocalJson, writeLocalJson } from "~/platform/browser";
import { legacyNamesText } from "./logic/legacy";

// 旧版的数据结构见 logic/legacy.ts；名字是编的
const OLD = { names: ["甲同学", " 乙同学 ", "", "丙同学"], settings: { backgroundColor: "#ffffff", textColor: "#000000", fontSizeRatio: 1 } };
const OLD_KEY = "namePickerData";
const NEW_KEY = "henji:random-picker:session";
const IMPORTED = ["甲同学", "乙同学", "丙同学"].join("\n");
type Saved = { state: { namesText: string } };

async function hydratedSession() {
  vi.resetModules();
  const { useSession } = await import("./store");
  await vi.waitFor(() => expect(useSession.persist.hasHydrated()).toBe(true));
  return useSession.getState();
}

beforeEach(() => {
  writeLocalJson(OLD_KEY, undefined);
  writeLocalJson(NEW_KEY, undefined);
});

describe("导入旧版名单", () => {
  it("新版还没存过时接过旧版的名单，存成新版数据，旧键不动", async () => {
    writeLocalJson(OLD_KEY, OLD);
    const session = await hydratedSession();
    expect(session.namesText).toBe(IMPORTED);
    expect(session.picked).toEqual([]);
    expect(readLocalJson<Saved>(NEW_KEY)?.state.namesText).toBe(IMPORTED);
    expect(readLocalJson(OLD_KEY)).toEqual(OLD);
  });

  it("新版已经有数据时不再导入，清空过的名单也不会被旧数据填回来", async () => {
    writeLocalJson(OLD_KEY, OLD);
    writeLocalJson(NEW_KEY, { state: { namesText: "", picked: [] }, version: 1 });
    expect((await hydratedSession()).namesText).toBe("");
  });

  it("没有旧数据时用示例名单", async () => {
    const { SAMPLE_NAMES } = await import("./store");
    expect((await hydratedSession()).namesText).toBe(SAMPLE_NAMES);
    expect(readLocalJson(NEW_KEY)).toBeUndefined();
  });

  it("旧数据结构不对或名单为空时不导入", () => {
    expect(legacyNamesText({ names: [] })).toBeUndefined();
    expect(legacyNamesText({ names: "甲同学" })).toBeUndefined();
    expect(legacyNamesText({ settings: {} })).toBeUndefined();
    expect(legacyNamesText(null)).toBeUndefined();
  });

  it("TOY 没有旧数据可读", async () => {
    const { createToyPlatform } = await import("~/platform/toy");
    expect(createToyPlatform().storage.legacy).toBeUndefined();
  });
});
