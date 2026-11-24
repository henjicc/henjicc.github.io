import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { RadioGroup } from "radix-ui";
import { useId } from "react";
import { cn } from "~/ui/lib/utils";
import { spring } from "~/ui/motion";

type SegmentedOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  /** 撑满一行，选项等分。 */
  block?: boolean;
  className?: string;
};

function Segmented<T extends string>({ label, value, onValueChange, options, block, className }: SegmentedProps<T>) {
  const indicatorId = useId();
  const reduceMotion = useReducedMotion();
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      orientation="horizontal"
      className={cn(
        "relative gap-0.5 rounded-md border border-line bg-surface-sunken p-[3px]",
        block ? "flex" : "inline-flex",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        const Icon = o.icon;
        return (
          <RadioGroup.Item
            key={o.value}
            value={o.value}
            className={cn(
              "relative inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border-0 bg-transparent px-3 text-ui transition-colors duration-(--dur-quick) ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring",
              on ? "text-ink" : "text-ink-muted",
              block && "flex-1 justify-center",
            )}
          >
            {on ? (
              <motion.span
                layoutId={indicatorId}
                transition={reduceMotion ? { duration: 0 } : spring}
                className="absolute inset-0 rounded-sm bg-surface-raised shadow-[0_1px_2px_rgb(0_0_0/0.18),inset_0_0_0_1px_var(--line)]"
              />
            ) : null}
            {Icon ? <Icon aria-hidden className="relative size-4" /> : null}
            <span className="relative">{o.label}</span>
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}

export { Segmented, type SegmentedOption };
