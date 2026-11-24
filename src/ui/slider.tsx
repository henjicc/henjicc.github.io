import { Slider as SliderPrimitive } from "radix-ui";
import { useId } from "react";
import { cn } from "~/ui/lib/utils";

type SliderProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** 数值后的单位，如 " px"、"%"。 */
  unit?: string;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
};

function Slider({ label, value, onValueChange, min = 0, max = 100, step = 1, unit = "", format, disabled, className }: SliderProps) {
  const id = useId();
  const shown = format ? format(value) : `${value}${unit}`;
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <label id={`${id}-label`} className="text-ui text-ink">
          {label}
        </label>
        <output aria-hidden className="font-num text-timecode text-ink-muted tabular-nums">
          {shown}
        </output>
      </div>
      <SliderPrimitive.Root
        data-slot="slider"
        value={[value]}
        onValueChange={(v) => onValueChange(v[0] ?? min)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="relative flex h-6 w-full cursor-pointer touch-none items-center select-none data-disabled:cursor-not-allowed"
      >
        <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-xs bg-line">
          <SliderPrimitive.Range className="absolute h-full bg-sky" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-labelledby={`${id}-label`}
          aria-valuetext={shown}
          className="block size-[18px] rounded-full bg-ink outline-none transition-shadow duration-(--dur-quick) ease-out hover:shadow-[0_0_0_6px_var(--sky-soft)] focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--focus-ring)] active:shadow-[0_0_0_6px_var(--sky-soft)]"
        />
      </SliderPrimitive.Root>
    </div>
  );
}

export { Slider };
