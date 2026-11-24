import { describe, expect, it } from "vitest";
import { exportConfigFile, exportTemplateFile, parseConfigFile, parseTemplateFile } from "./transfer";

const configs = [{ id: "a", name: "示例接口", baseUrl: "https://llm.example.test/v1", model: "demo" }];

describe("接口配置", () => {
  it("默认导出不带密钥，勾选才带", () => {
    const keys = { a: "sk-fictional-123" };
    expect(exportConfigFile(configs, keys, false)).not.toContain("sk-fictional-123");
    expect(JSON.parse(exportConfigFile(configs, keys, true)).apiConfigs[0].apiKey).toBe("sk-fictional-123");
  });

  it("导出的文件能再导入", () => {
    expect(parseConfigFile(exportConfigFile(configs, {}, false))).toEqual([{ name: "示例接口", baseUrl: "https://llm.example.test/v1", model: "demo" }]);
  });

  it("兼容旧版导出的文件（带 id、createdAt、空密钥）", () => {
    const old = JSON.stringify({
      apiConfigs: [{ id: "default", name: "默认配置", baseUrl: "https://llm.example.test/v1", apiKey: "", model: "demo", createdAt: 1 }],
      activeApiConfigId: "default",
      version: "1.0",
    });
    expect(parseConfigFile(old)).toEqual([{ name: "默认配置", baseUrl: "https://llm.example.test/v1", model: "demo" }]);
  });

  it("缺字段或不是 JSON 时给出原因", () => {
    expect(() => parseConfigFile("{")).toThrow("不是 JSON");
    expect(() => parseConfigFile(JSON.stringify({ apiConfigs: [{ name: "x", baseUrl: "" , model: "m" }] }))).toThrow("没有可用的接口配置");
    expect(() => parseConfigFile(JSON.stringify({ apiConfigs: [] }))).toThrow();
  });
});

describe("提示词模板", () => {
  it("往返一致，旧文件能导入", () => {
    const templates = [{ id: "t", name: "改写", systemPrompt: "你是助手", userPrompt: "改写：{content}" }];
    expect(parseTemplateFile(exportTemplateFile(templates))).toEqual([{ name: "改写", systemPrompt: "你是助手", userPrompt: "改写：{content}" }]);
    const old = JSON.stringify({ promptTemplates: [{ id: "x", name: "旧", systemPrompt: "s", userPrompt: "u", createdAt: 1 }], activeTemplateId: "x" });
    expect(parseTemplateFile(old)).toHaveLength(1);
  });

  it("没有用户提示词的拒绝", () => {
    expect(() => parseTemplateFile(JSON.stringify({ promptTemplates: [{ name: "x", systemPrompt: "s" }] }))).toThrow("没有可用的模板");
  });
});
