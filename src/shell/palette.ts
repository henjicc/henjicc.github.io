import { create } from "zustand";

// 命令面板的开关放在外壳里，顶栏搜索、工具页的“切换工具”和 Ctrl K 都改这一个状态。
// loaded：打开过一次之后就一直挂着面板的代码，关上再开不用重新加载。
export const usePalette = create<{ open: boolean; loaded: boolean }>(() => ({ open: false, loaded: false }));

export function setPaletteOpen(open: boolean) {
  usePalette.setState((s) => ({ open, loaded: s.loaded || open }));
}

export function togglePalette() {
  setPaletteOpen(!usePalette.getState().open);
}

/** 预先加载命令面板的代码，第一次打开时不用等。 */
export function preloadPalette() {
  return import("./CommandPalette");
}
