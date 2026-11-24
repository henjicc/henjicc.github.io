import { lazy } from "react";
import type { ToolEntry, ToolLoader, ToolMeta } from "./types";

export function defineTool(meta: ToolMeta, load?: ToolLoader): ToolEntry {
  // lazy 只是包一层，不会去加载；打开工具页时才下载它的代码
  return { ...meta, load, Component: load ? lazy(load) : undefined };
}
