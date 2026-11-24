import type * as React from "react";
import { cn } from "~/ui/lib/utils";

// 雾层面板只能放在场景照片上；实心底色上的面板一律用 surface。
function MistPanel({ className, strong, ...props }: React.ComponentProps<"div"> & { strong?: boolean }) {
  return <div className={cn("mist-panel", strong && "bg-mist-strong", className)} {...props} />;
}

export { MistPanel };
