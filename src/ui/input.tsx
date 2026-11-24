import type * as React from "react";
import { cn } from "~/ui/lib/utils";

const fieldBox =
  "w-full min-w-0 rounded-sm border border-line-strong bg-surface-raised text-ui font-normal text-ink outline-none transition-[border-color,box-shadow] duration-(--dur-quick) ease-out placeholder:text-ink-faint focus:border-sky-line focus:shadow-[0_0_0_3px_var(--sky-soft)] disabled:cursor-not-allowed disabled:text-ink-faint aria-invalid:border-ember";

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBox, "h-10 px-3 max-md:h-11", className)} {...props} />;
}

export { Input, fieldBox };
