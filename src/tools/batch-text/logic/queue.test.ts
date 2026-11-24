import { describe, expect, it } from "vitest";
import { countByStatus, missingRequirements, retryFailed, stopProcessing, type QueueItem } from "./queue";

const item = (id: string, status: QueueItem["status"]): QueueItem => ({ id, name: `${id}.txt`, size: 1, content: "x", status });

describe("队列", () => {
  it("停止把处理中的放回待处理，重试把失败的放回待处理", () => {
    const items = [item("a", "processing"), item("b", "completed"), { ...item("c", "error"), error: "坏了" }];
    expect(stopProcessing(items).map((i) => i.status)).toEqual(["pending", "completed", "error"]);
    const retried = retryFailed(items);
    expect(retried.map((i) => i.status)).toEqual(["processing", "completed", "pending"]);
    expect(retried[2]!.error).toBeUndefined();
    expect(countByStatus(items)).toEqual({ pending: 0, processing: 1, completed: 1, error: 1 });
  });
});

describe("missingRequirements", () => {
  const config = { id: "c", name: "示例", baseUrl: "https://llm.example.test/v1", model: "demo" };
  const template = { id: "t", name: "示例", systemPrompt: "", userPrompt: "{content}" };
  const base = { items: [item("a", "pending")], config, apiKey: "k", template, secureContext: true };

  it("都齐了就是空", () => {
    expect(missingRequirements(base)).toEqual([]);
  });

  it("列出缺的每一项", () => {
    expect(missingRequirements({ ...base, items: [item("a", "completed")], apiKey: " ", template: undefined })).toEqual([
      "没有待处理的文件，先添加文本文件",
      "先选一个提示词模板",
      "还没填写接口密钥",
    ]);
  });

  it("模型名为空、密钥带了中文或空格时说清楚", () => {
    expect(missingRequirements({ ...base, config: { ...config, model: "" }, apiKey: "sk-复制多了" })).toEqual([
      "模型名还没填",
      "接口密钥里有空格、中文或其他不能用的字符，检查是不是复制多了",
    ]);
    // 首尾空白不算错，发请求时会去掉
    expect(missingRequirements({ ...base, apiKey: " sk-fictional \n" })).toEqual([]);
  });

  it("HTTPS 页面上的 HTTP 地址在开始前就拦下", () => {
    const out = missingRequirements({ ...base, config: { ...config, baseUrl: "http://192.168.1.20/v1" } });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("HTTP");
  });
});
