import { useEffect, useRef } from "react";

export type PrimaryHotkey = "mod+enter" | "space";

const INTERACTIVE = "input, textarea, select, button, a[href], [contenteditable=''], [contenteditable='true'], [role='switch'], [role='radio'], [role='slider'], [role='checkbox'], [role='tab'], [role='option']";

/**
 * 工具主操作的快捷键。默认 Ctrl/⌘ Enter；space 时只在焦点不在可操作的元素上时响应，
 * 焦点在按钮上时让浏览器自己按空格点它，避免触发两次。有浮层（命令面板、对话框）打开时不响应。
 */
export function usePrimaryHotkey(hotkey: PrimaryHotkey, run: () => void, enabled: boolean) {
  const latest = useRef(run);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat) return;
      if (document.querySelector("[role='dialog'][data-state='open']")) return;
      if (hotkey === "space") {
        if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target instanceof Element && e.target.closest(INTERACTIVE)) return;
      } else if (!(e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        return;
      }
      e.preventDefault();
      latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, enabled]);
}
