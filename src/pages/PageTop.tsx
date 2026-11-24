import type { ReactNode } from "react";

/** 栏目页的页头：display 标题 + 一句导语，右侧可放切换控件。 */
export function PageTop({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="flex animate-mist-in flex-wrap items-end gap-x-6 gap-y-3 pt-16 pb-10 md:pt-20">
      <h1 className="m-0 text-title-1 md:text-display">{title}</h1>
      {lead ? <p className="m-0 text-body text-ink-muted md:mb-3">{lead}</p> : null}
      {children ? <div className="md:mb-1.5 md:ml-auto">{children}</div> : null}
    </div>
  );
}
