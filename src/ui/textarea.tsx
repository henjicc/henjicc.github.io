import type * as React from "react";
import { fieldBox } from "~/ui/input";
import { cn } from "~/ui/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBox, "block min-h-42 resize-y p-3 leading-[1.7]", className)}
      {...props}
    />
  );
}

export { Textarea };
