import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "~/ui/lib/utils";

/**
 * 主按钮旁边的次要按钮位。次要按钮常常随状态出现又消失（“清空记录”抽取时隐藏、停下后出现），
 * 每次都让主按钮和旁边的东西跳一下。这里记住出现过的最大宽度并一直占着，之后再隐藏也不会挪动邻居。
 * 第一次出现前不占位，外壳也不知道工具会放什么按钮。
 */
export function ActionSlot({ children, className }: { children?: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [reserve, setReserve] = useState(0);
  const has = Boolean(children);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setReserve((r) => Math.max(r, el.offsetWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [has]);

  if (!has && !reserve) return null;
  return (
    <div className={cn("flex flex-none justify-end", className)} style={{ minWidth: reserve || undefined }}>
      <div ref={inner} className="flex w-max items-center gap-2 empty:hidden">
        {children}
      </div>
    </div>
  );
}
