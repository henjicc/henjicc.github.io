import { Switch as SwitchPrimitive } from "radix-ui";
import { useId } from "react";
import { cn } from "~/ui/lib/utils";

type SwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

// 圆润的轨道配圆形滑块（设计系统否决了直角和切角）。
function Switch({ label, checked, onCheckedChange, disabled, className }: SwitchProps) {
  const id = useId();
  return (
    <div className={cn("flex min-h-8 items-center max-md:min-h-11 justify-between gap-3", className)}>
      <label htmlFor={id} className="cursor-pointer text-ui text-ink">
        {label}
      </label>
      <SwitchPrimitive.Root
        id={id}
        data-slot="switch"
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="focus-ring group relative h-6 w-[42px] before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] flex-none cursor-pointer rounded-full border border-line-strong bg-surface-raised p-0 transition-[background-color,border-color] duration-(--dur-base) ease-out data-[state=checked]:border-sky data-[state=checked]:bg-sky disabled:cursor-not-allowed"
      >
        <SwitchPrimitive.Thumb className="absolute top-[3px] left-[3px] block size-4 rounded-full bg-ink-muted shadow-[0_1px_2px_rgb(0_0_0/0.2)] transition-[translate,background-color] duration-(--dur-base) ease-out data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-sky" />
      </SwitchPrimitive.Root>
    </div>
  );
}

export { Switch };
