import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "~/ui/lib/utils";

// 状态色只用在文字和图标上，浅底用对应的 -soft；状态总要带一个词，不只靠颜色。
const tagVariants = cva(
  "inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-sm px-2 text-micro leading-none [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-surface-raised text-ink-muted",
        sky: "bg-sky-soft text-sky-text",
        moss: "bg-moss-soft text-moss",
        amber: "bg-amber-soft text-amber",
        ember: "bg-ember-soft text-ember",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Tag({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof tagVariants>) {
  return <span className={cn(tagVariants({ tone, className }))} {...props} />;
}

export { Tag };
