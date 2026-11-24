import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { spring } from "~/ui/motion";

/** 收起时露出的高度：把手 + 一行摘要。 */
export const SHEET_PEEK = 64;

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
  /** 抽屉实际占的高度（展开时的整高，收起时的露出部分），外壳据此把舞台内容挪到抽屉上方。 */
  onCoverChange?: (height: number) => void;
};

// 手机工具的设置抽屉：收起只露出把手和一行摘要；点一下或往上拖展开（约 62% 屏高），松手按位置和速度吸附到两档之一。
export function BottomSheet({ open, onOpenChange, summary, children, onCoverChange }: BottomSheetProps) {
  const sheet = useRef<HTMLElement>(null);
  const handle = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const y = useMotionValue(0);
  const drag = useDragControls();
  const reduceMotion = useReducedMotion();
  const dragged = useRef(false);
  const settled = useRef(false);
  const bodyId = useId();
  const closedY = Math.max(0, height - SHEET_PEEK);

  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el) return;
    setHeight(el.offsetHeight);
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!height) return;
    const target = open ? 0 : closedY;
    // 第一次量到高度时直接放到位，不播放动画
    if (!settled.current || reduceMotion) {
      y.set(target);
      settled.current = true;
      return;
    }
    const controls = animate(y, target, spring);
    return () => controls.stop();
  }, [open, closedY, height, reduceMotion, y]);

  useEffect(() => {
    onCoverChange?.(open ? height : Math.min(height, SHEET_PEEK));
  }, [open, height, onCoverChange]);

  // 收起时内容区变成 inert，焦点留在里面会掉到 body 上；先把焦点交给把手，再设 inert。
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    if (!open && el.contains(document.activeElement)) handle.current?.focus();
    el.inert = !open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // 抽屉里的下拉、弹窗（Radix）在捕获阶段处理 Esc 并 preventDefault：这一下只关它们，不连抽屉一起收起
      if (e.key === "Escape" && !e.defaultPrevented) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <motion.section
      ref={sheet}
      aria-label="设置"
      style={{ y, visibility: height ? "visible" : "hidden" }}
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: closedY }}
      dragElastic={0.04}
      dragMomentum={false}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={(_, info) => {
        const fast = Math.abs(info.velocity.y) > 400;
        const toOpen = fast ? info.velocity.y < 0 : y.get() < closedY / 2;
        if (toOpen === open) animate(y, toOpen ? 0 : closedY, reduceMotion ? { duration: 0 } : spring);
        else onOpenChange(toOpen);
      }}
      className="absolute inset-x-0 bottom-0 z-2 grid h-[62%] grid-rows-[auto_minmax(0,1fr)] rounded-t-xl border-t border-line bg-surface shadow-float"
    >
      <button
        ref={handle}
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onPointerDown={(e) => {
          dragged.current = false;
          drag.start(e);
        }}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onOpenChange(!open);
        }}
        className="grid h-16 cursor-grab touch-none grid-cols-[1fr_auto] content-start items-center gap-x-3 gap-y-1.5 rounded-t-xl border-0 bg-transparent px-5 pt-2.5 text-left text-ink select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus-ring"
      >
        <i aria-hidden className="col-span-2 h-1 w-9 justify-self-center rounded-full bg-line-strong" />
        <span className="truncate text-ui">{summary}</span>
        <span className="text-caption font-medium text-sky-text">{open ? "收起" : "设置"}</span>
      </button>
      <div ref={body} id={bodyId} className="grid content-start gap-6 overflow-auto overscroll-contain px-5 pt-1 pb-5">
        {children}
      </div>
    </motion.section>
  );
}
