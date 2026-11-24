import { useMatches } from "react-router";
import { singleToolId } from "./env";

/**
 * 路由的 handle：页面告诉外壳该怎么摆顶栏和页脚。网站在路由模块里 `export const handle`，TOY 在路由表里写同样的对象。
 * - header：scene 是首页首屏和 404 那种透明顶栏压在照片上，滚动后变实；默认 solid。
 * - tool：工具页。顶栏换成面包屑，没有页脚；手机上整页交给工具外壳。
 * - footer：false 时不放页脚，如 404 那种正好一屏、不该能滚动的页面。
 */
export type ShellHandle = {
  header?: "scene" | "solid";
  tool?: boolean;
  footer?: boolean;
};

/** 工具路由的地址参数：TOY 写成 tools/:id，网站写成 tools/*（原因见 src/web/routes.ts），通配部分去掉结尾的斜杠。 */
export function toolIdFromParams(params: Record<string, string | undefined>): string | undefined {
  return params.id ?? params["*"]?.replace(/\/+$/, "");
}

export function useShellRoute(): { handle: ShellHandle; toolId: string | null } {
  const matches = useMatches();
  const last = matches[matches.length - 1];
  const handle = (last?.handle ?? {}) as ShellHandle;
  const toolId = handle.tool ? ((last && toolIdFromParams(last.params)) ?? singleToolId ?? null) : null;
  return { handle, toolId };
}
