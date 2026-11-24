import { describe, expect, it } from "vitest";
import { buildMessages, fillPrompt, hasPlaceholder } from "./prompt";

describe("fillPrompt", () => {
  it("替换所有 {content}，不只第一个", () => {
    expect(fillPrompt("A:{content}\nB:{content}", "雾")).toBe("A:雾\nB:雾");
  });

  it("内容里的 $& $' $` $1 原样保留", () => {
    const content = "价格 $& 和 $' 还有 $` 以及 $1";
    expect(fillPrompt("请改写：{content}", content)).toBe(`请改写：${content}`);
  });

  it("模板里没有 {content} 时把内容接在提示词后面", () => {
    expect(hasPlaceholder("总结一下")).toBe(false);
    expect(fillPrompt("总结一下", "林间小路")).toBe("总结一下\n\n林间小路");
    expect(fillPrompt("  ", "林间小路")).toBe("林间小路");
  });
});

describe("buildMessages", () => {
  it("有系统提示词时放在最前面", () => {
    expect(buildMessages({ systemPrompt: "你是助手", userPrompt: "处理：{content}" }, "一段虚构的文字")).toEqual([
      { role: "system", content: "你是助手" },
      { role: "user", content: "处理：一段虚构的文字" },
    ]);
  });

  it("系统提示词为空时不发空的 system 消息", () => {
    expect(buildMessages({ systemPrompt: " ", userPrompt: "{content}" }, "x")).toEqual([{ role: "user", content: "x" }]);
  });
});
