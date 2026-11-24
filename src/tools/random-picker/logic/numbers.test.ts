import { describe, expect, it } from "vitest";
import { generateNumbers, MAX_NUMBERS, validateRange } from "./numbers";

describe("generateNumbers", () => {
  it("补零时按结束值的位数补齐", () => {
    expect(generateNumbers({ start: 1, end: 12, step: 1, padZero: true }).slice(0, 3)).toEqual(["01", "02", "03"]);
    expect(generateNumbers({ start: 8, end: 100, step: 46, padZero: true })).toEqual(["008", "054", "100"]);
  });

  it("不补零、按间隔生成，结束值不在步长上时不越过它", () => {
    expect(generateNumbers({ start: 1, end: 10, step: 4, padZero: false })).toEqual(["1", "5", "9"]);
  });

  it("起止相同时只有一个号码", () => {
    expect(generateNumbers({ start: 5, end: 5, step: 1, padZero: true })).toEqual(["5"]);
  });

  it("参数不对时不生成", () => {
    expect(generateNumbers({ start: 10, end: 1, step: 1, padZero: false })).toEqual([]);
  });
});

describe("validateRange", () => {
  it("说清楚哪一项不对", () => {
    expect(validateRange({ start: 1.5, end: 3, step: 1, padZero: false })).toEqual({ start: "起始填一个整数" });
    expect(validateRange({ start: 5, end: 1, step: 1, padZero: false })).toEqual({ end: "结束不能比起始小" });
    expect(validateRange({ start: 1, end: 5, step: 0, padZero: false })).toEqual({ step: "间隔至少是 1" });
    expect(validateRange({ start: 1, end: Number.NaN, step: 1, padZero: false })).toEqual({ end: "结束填一个整数" });
  });

  it("超过上限时拦下，正好在上限内的放行", () => {
    expect(validateRange({ start: 1, end: MAX_NUMBERS, step: 1, padZero: false })).toEqual({});
    expect(validateRange({ start: 1, end: MAX_NUMBERS + 1, step: 1, padZero: false }).end).toContain(String(MAX_NUMBERS));
  });
});
