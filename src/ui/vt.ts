import type { CSSProperties } from "react";

// 共享元素过渡：工具卡片上的图标块和工具名与工具页顶栏同名，切页时飞过去。
// 同一时刻页面上每个名字只能出现一次，否则浏览器会放弃这次过渡。
// data-vt 让主题切换时能临时去掉这些名字（见 global.css 的 .vt-theme）。
export function toolTransition(id: string, part: "icon" | "name") {
  return {
    "data-vt": "",
    style: {
      viewTransitionName: `tool-${id}-${part}`,
      viewTransitionClass: part === "name" ? "tool-name" : undefined,
    } as CSSProperties,
  };
}
