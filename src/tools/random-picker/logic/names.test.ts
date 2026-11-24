import { describe, expect, it } from "vitest";
import { canStart, namesFromFile, nextRollingName, parseNames, pickOne, remainingPool } from "./names";

describe("parseNames", () => {
  it("每行一个名字，去掉空白和空行，保留重名", () => {
    expect(parseNames("  张三 \r\n\n李四\n张三\n   \n")).toEqual(["张三", "李四", "张三"]);
  });
});

describe("namesFromFile", () => {
  it("txt 按行读取，去掉 BOM", () => {
    expect(namesFromFile("\uFEFF张三\n李四\n", "名单.txt")).toEqual(["张三", "李四"]);
  });
  it("csv 取第一列并去掉引号", () => {
    expect(namesFromFile('"王五",3班\n赵六,4班\n,空\n', "list.CSV")).toEqual(["王五", "赵六"]);
  });
});

describe("remainingPool", () => {
  const names = ["甲", "乙", "丙", "甲"];

  it("允许重复时总是整份名单", () => {
    expect(remainingPool(names, ["甲", "乙"], false)).toEqual(names);
  });

  it("不重复时按次数去掉抽过的人，重名的人各算一次", () => {
    expect(remainingPool(names, ["甲"], true)).toEqual(["乙", "丙", "甲"]);
    expect(remainingPool(names, ["甲", "甲"], true)).toEqual(["乙", "丙"]);
  });

  it("已经不在名单里的抽取记录不影响结果", () => {
    expect(remainingPool(["甲", "乙"], ["丁"], true)).toEqual(["甲", "乙"]);
  });
});

describe("pickOne", () => {
  it("按随机数取池子里的一个，随机数取到 1 也不越界", () => {
    expect(pickOne(["a", "b", "c"], () => 0)).toBe("a");
    expect(pickOne(["a", "b", "c"], () => 0.5)).toBe("b");
    expect(pickOne(["a", "b", "c"], () => 1)).toBe("c");
    expect(pickOne([], () => 0.5)).toBeUndefined();
  });

  it("不重复地连抽，直到抽完整份名单", () => {
    const names = ["甲", "乙", "丙", "丁"];
    const picked: string[] = [];
    for (let i = 0; i < names.length; i++) {
      const next = pickOne(remainingPool(names, picked, true));
      expect(next).toBeDefined();
      picked.push(next as string);
    }
    expect([...picked].sort()).toEqual([...names].sort());
    expect(canStart(names, remainingPool(names, picked, true))).toEqual({ ok: false, reason: "exhausted" });
  });
});

describe("nextRollingName", () => {
  it("池子里不止一个名字时不和上一帧相同", () => {
    for (let i = 0; i < 20; i++) expect(nextRollingName(["甲", "乙"], "甲")).toBe("乙");
  });
  it("只剩一个名字时就是它", () => {
    expect(nextRollingName(["甲"], "甲")).toBe("甲");
  });
});

describe("canStart", () => {
  it("名单为空和都抽过是两种情况", () => {
    expect(canStart([], [])).toEqual({ ok: false, reason: "empty" });
    expect(canStart(["甲"], [])).toEqual({ ok: false, reason: "exhausted" });
    expect(canStart(["甲"], ["甲"])).toEqual({ ok: true });
  });
});
