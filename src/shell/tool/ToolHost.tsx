import { Suspense } from "react";
import type { ToolEntry } from "~/tools/types";
import { useHydrated } from "../media";

/** 工具界面加载出来之前的占位，和桌面布局同样的分栏，避免切换时跳动。 */
function ToolPlaceholder() {
  return (
    <div aria-hidden className="grid h-[calc(100dvh-64px)] min-h-[560px] md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="hidden border-r border-line bg-surface md:block" />
      <div className="bg-surface-sunken" />
    </div>
  );
}

/**
 * 按需加载工具界面。工具只在浏览器里渲染：它们要读存储、看屏幕宽度，预渲染出来也是错的默认值；
 * 预渲染的工具页只有顶栏和占位（页面标题、描述在路由的 meta 里）。
 */
export function ToolHost({ tool }: { tool: ToolEntry }) {
  const hydrated = useHydrated();
  const { Component } = tool;
  if (!hydrated || !Component) return <ToolPlaceholder />;
  return (
    <Suspense fallback={<ToolPlaceholder />}>
      <Component />
    </Suspense>
  );
}
