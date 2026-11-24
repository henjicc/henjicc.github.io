import { checkBaseUrl, ENDPOINT_MESSAGES, INVALID_KEY_MESSAGE, isValidApiKey, type ApiConfig } from "./api";
import type { PromptTemplate } from "./prompt";

export type ItemStatus = "pending" | "processing" | "completed" | "error";

export type QueueItem = {
  id: string;
  name: string;
  size: number;
  content: string;
  status: ItemStatus;
  result?: string;
  error?: string;
};

export type Counts = Record<ItemStatus, number>;

export function countByStatus(items: readonly QueueItem[]): Counts {
  const counts: Counts = { pending: 0, processing: 0, completed: 0, error: 0 };
  for (const item of items) counts[item.status]++;
  return counts;
}

/** 停止（包括离开页面）：正在处理的放回待处理，结果作废。 */
export function stopProcessing(items: readonly QueueItem[]): QueueItem[] {
  return items.map((item) => (item.status === "processing" ? { ...item, status: "pending" } : item));
}

/** 重试失败：失败的放回待处理，再点一次开始。 */
export function retryFailed(items: readonly QueueItem[]): QueueItem[] {
  return items.map((item) => (item.status === "error" ? { ...item, status: "pending", error: undefined } : item));
}

/** 开始前检查，返回还缺什么；空数组就是可以开始。 */
export function missingRequirements(input: {
  items: readonly QueueItem[];
  config: ApiConfig | undefined;
  apiKey: string;
  template: PromptTemplate | undefined;
  secureContext: boolean;
}): string[] {
  const missing: string[] = [];
  if (!input.items.some((i) => i.status === "pending")) missing.push("没有待处理的文件，先添加文本文件");
  if (!input.template) missing.push("先选一个提示词模板");
  if (!input.config) {
    missing.push("先选一套接口配置");
  } else {
    const problem = checkBaseUrl(input.config.baseUrl, input.secureContext);
    if (problem) missing.push(ENDPOINT_MESSAGES[problem]);
    if (!input.config.model.trim()) missing.push("模型名还没填");
  }
  const key = input.apiKey.trim();
  if (!key) missing.push("还没填写接口密钥");
  else if (!isValidApiKey(key)) missing.push(INVALID_KEY_MESSAGE);
  return missing;
}
