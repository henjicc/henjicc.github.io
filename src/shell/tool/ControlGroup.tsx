import type { ReactNode } from "react";
import { cn } from "~/ui/lib/utils";

/** 控制栏里的一组设置：小标题 + 控件，组与组之间有分隔线。 */
export function ControlGroup({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid gap-4 [&+&]:border-t [&+&]:border-line [&+&]:pt-6", className)}>
      {title ? <h3 className="m-0 text-caption font-semibold leading-[1.4] text-ink-muted">{title}</h3> : null}
      {children}
    </section>
  );
}
