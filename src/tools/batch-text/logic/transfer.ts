// 接口配置和提示词模板的导入导出。文件结构沿用旧版（apiConfigs / promptTemplates 数组），旧版导出的文件能直接导入。
import { z } from "zod";
import type { ApiConfig } from "./api";
import type { PromptTemplate } from "./prompt";

const filled = z.string().trim().min(1);

const configFile = z.object({
  apiConfigs: z
    .array(z.object({ name: filled, baseUrl: filled, model: filled, apiKey: z.string().optional() }))
    .min(1),
});

const templateFile = z.object({
  promptTemplates: z.array(z.object({ name: filled, systemPrompt: z.string().default(""), userPrompt: filled })).min(1),
});

export type ImportedConfig = Omit<ApiConfig, "id"> & { apiKey?: string };
export type ImportedTemplate = Omit<PromptTemplate, "id">;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("这个文件不是 JSON");
  }
}

export function parseConfigFile(text: string): ImportedConfig[] {
  const result = configFile.safeParse(parseJson(text));
  if (!result.success) throw new Error("文件里没有可用的接口配置，每套都要有名称、接口地址和模型");
  return result.data.apiConfigs.map(({ name, baseUrl, model, apiKey }) => ({
    name: name.trim(),
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    ...(apiKey ? { apiKey } : {}),
  }));
}

export function parseTemplateFile(text: string): ImportedTemplate[] {
  const result = templateFile.safeParse(parseJson(text));
  if (!result.success) throw new Error("文件里没有可用的模板，每个都要有名称和用户提示词");
  return result.data.promptTemplates.map(({ name, systemPrompt, userPrompt }) => ({ name: name.trim(), systemPrompt, userPrompt }));
}

/** 密钥默认不进文件；includeKeys 为 true 时才带上（明文）。 */
export function exportConfigFile(configs: readonly ApiConfig[], keys: Readonly<Record<string, string>>, includeKeys: boolean): string {
  const apiConfigs = configs.map(({ id, name, baseUrl, model }) =>
    includeKeys && keys[id] ? { name, baseUrl, model, apiKey: keys[id] } : { name, baseUrl, model },
  );
  return JSON.stringify({ apiConfigs, version: 2 }, null, 2);
}

export function exportTemplateFile(templates: readonly PromptTemplate[]): string {
  const promptTemplates = templates.map(({ name, systemPrompt, userPrompt }) => ({ name, systemPrompt, userPrompt }));
  return JSON.stringify({ promptTemplates, version: 2 }, null, 2);
}
