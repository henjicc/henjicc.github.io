import type * as React from "react";
import { cn } from "~/ui/lib/utils";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 items-center rounded-xs border border-b-2 border-line bg-surface-raised px-1.5 font-num text-keycap text-ink-muted tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
