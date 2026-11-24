import { ToolHost } from "~/shell/tool/ToolHost";
import type { ToolEntry } from "~/tools/types";

/** 单个工具的页面。找不到工具时怎么办由各自的路由决定：网站显示 404，TOY 回到首页。 */
export function ToolPage({ tool }: { tool: ToolEntry }) {
  return <ToolHost tool={tool} />;
}
