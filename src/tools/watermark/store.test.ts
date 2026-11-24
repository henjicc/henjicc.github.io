// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { platform } from "~/platform";
import { FACTORY_APP, FACTORY_MARK } from "./logic/settings";
import meta from "./meta";
import { useDraft } from "./store";

const settings = platform.storage.settings(meta.id);
const local = platform.storage.local(meta.id);
// 第 1 版的草稿：右下格里往左上调过一点
const draftV1 = { state: { current: { ...FACTORY_MARK, size: 48, position: "bottom-right", offsetX: 80, offsetY: -80 } }, version: 1 };

beforeEach(async () => {
  await settings.remove("settings");
  await local.remove("draft");
});

it("第 1 版草稿按存着的单位换算：像素单位的 48 不当成占图 48% 的水印", async () => {
  await settings.set("settings", { state: { ...FACTORY_APP, unit: "px" }, version: 1 });
  await local.set("draft", draftV1);
  await useDraft.persist.rehydrate();
  // 不知道图多大，退回不计水印大小的换算
  expect(useDraft.getState().current).toMatchObject({ offsetX: -10, offsetY: -10 });
});

it("第 1 版草稿在百分比单位下计入水印宽度", async () => {
  await local.set("draft", draftV1);
  await useDraft.persist.rehydrate();
  expect(useDraft.getState().current.offsetX).toBeCloseTo(-10 * (1 - 0.48));
});
