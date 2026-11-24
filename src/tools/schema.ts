// 登记表的结构校验。只在构建（react-router.config.ts、scripts/toy.ts）和测试里用，不进浏览器包。
import { z } from "zod";
import type { ToolEntry } from "./types";

export const toolMetaSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "id 只能用小写字母、数字和连字符"),
  name: z.string().min(1).max(12),
  summary: z.string().min(1).max(40),
  icon: z.custom((v) => typeof v === "function" || (typeof v === "object" && v !== null), "icon 要是 lucide-react 的图标组件"),
  status: z.enum(["live", "plan"]),
  keywords: z.array(z.string().min(1)),
  toy: z.boolean(),
});

export function validateRegistry(entries: readonly ToolEntry[]): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    toolMetaSchema.parse(entry);
    if (seen.has(entry.id)) throw new Error(`工具 id 重复：${entry.id}`);
    seen.add(entry.id);
    if (entry.status === "live" && !entry.load) throw new Error(`可用的工具必须有界面：${entry.id}`);
  }
}
