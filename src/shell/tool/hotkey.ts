import { useEffect, useRef } from "react";

export type PrimaryHotkey = "mod+enter" | "space";

/** 在这些元素里空格是在打字，永远不当快捷键。 */
const TEXT_ENTRY =
  "textarea, select, [contenteditable=''], [contenteditable='true'], input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='file'], [type='color'])";
/** 空格本来就会操作它们（按下按钮、切换开关、选中选项）。 */
const CONTROL = "button, a[href], input, [role='switch'], [role='radio'], [role='slider'], [role='checkbox'], [role='tab'], [role='option'], [role='button']";

/**
 * 工具主操作的快捷键。默认 Ctrl/⌘ Enter。有浮层（命令面板、对话框）打开时不响应。
 *
 * space 时的取舍：
 * - 焦点在输入框里：空格是在打字，不响应。
 * - 焦点在按钮、开关、滑块上，而且是用键盘（Tab、方向键）走过去的：空格操作这个控件，不触发主操作。
 * - 焦点在控件上，但是用鼠标或手指点过去的（比如滚动时点了一下“抽过的人不再抽到”，或点了全屏）：
 *   访客的手已经回到键盘上要按空格停下，这时空格给主操作，并拦下浏览器对这个控件的默认点击。
 */
export function usePrimaryHotkey(hotkey: PrimaryHotkey, run: () => void, enabled: boolean) {
  const latest = useRef(run);
  // 最近一次是点进来的（pointerdown），还是用键盘走到当前元素的。主操作临时禁用时也要一直记着
  const pointerFocus = useRef(false);
  useEffect(() => {
    latest.current = run;
  });
  useEffect(() => {
    const onPointer = () => {
      pointerFocus.current = true;
    };
    const onKeyCapture = (e: KeyboardEvent) => {
      if (e.code !== "Space") pointerFocus.current = false;
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKeyCapture, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKeyCapture, true);
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return;
      if (document.querySelector("[role='dialog'][data-state='open']")) return;
      if (hotkey === "space") {
        if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey) return;
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest(TEXT_ENTRY)) return;
        if (target?.closest(CONTROL) && !pointerFocus.current) return;
      } else if (!(e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
        return;
      }
      e.preventDefault();
      // 按住不放时的自动重复只拦下（不然空格会一直滚动页面），不重复触发主操作
      if (!e.repeat) latest.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, enabled]);
}
