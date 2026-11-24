import { FileText } from "lucide-react";
import type { ToolMeta } from "../types";

export default {
  id: "batch-text",
  name: "批量文本处理",
  summary: "用大模型批量改写、翻译、总结一堆文本文件。",
  icon: FileText,
  status: "live",
  keywords: ["plwb", "piliang", "llm", "ai", "改写", "翻译", "总结", "大模型"],
  // 第一期只上网站：TOY 的来源被所有 TOY 共用，接口密钥没有安全的地方存
  toy: false,
} satisfies ToolMeta;
