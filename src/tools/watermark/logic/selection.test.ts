import { expect, it } from "vitest";
import { clickSelect, targetIds } from "./selection";

const ids = ["a", "b", "c", "d"];

it("普通单击清空多选，记下起点", () => {
  expect(clickSelect(ids, { selected: ["a", "b"], anchor: "a" }, "c", {})).toEqual({ selected: [], anchor: "c" });
});

it("Ctrl 单击加减一张，按列表顺序", () => {
  const s1 = clickSelect(ids, { selected: [], anchor: null }, "c", { toggle: true });
  const s2 = clickSelect(ids, s1, "a", { toggle: true });
  expect(s2.selected).toEqual(["a", "c"]);
  expect(clickSelect(ids, s2, "c", { toggle: true }).selected).toEqual(["a"]);
});

it("Shift 单击从起点选到这张，两个方向都行", () => {
  expect(clickSelect(ids, { selected: [], anchor: "b" }, "d", { range: true }).selected).toEqual(["b", "c", "d"]);
  expect(clickSelect(ids, { selected: [], anchor: "c" }, "a", { range: true }).selected).toEqual(["a", "b", "c"]);
});

it("操作对象：有多选用多选，否则当前图", () => {
  expect(targetIds(ids, ["d", "b"], "a")).toEqual(["b", "d"]);
  expect(targetIds(ids, [], "a")).toEqual(["a"]);
  expect(targetIds(ids, [], null)).toEqual([]);
});
