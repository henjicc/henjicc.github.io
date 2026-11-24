import { lazy } from "react";
import type { ToolEntry, ToolLoader, ToolMeta } from "./types";

declare module "./types" {
  interface ToolMeta {
    /**
     * 文件是否只在访客的浏览器里处理，默认 true。工具页页脚据此写“文件不会上传”或“会发送到你配置的接口”；
     * 要把内容发到外部接口的工具（如批量文本处理）写 false，不能让页面许下做不到的承诺。
     */
    local?: boolean;
  }
}

export function defineTool(meta: ToolMeta, load?: ToolLoader): ToolEntry {
  // lazy 只是包一层，不会去加载；打开工具页时才下载它的代码
  return { ...meta, local: meta.local ?? true, load, Component: load ? lazy(load) : undefined };
}
