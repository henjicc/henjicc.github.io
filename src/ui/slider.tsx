import { Slider as SliderPrimitive } from "radix-ui";
import { useId, useState } from "react";
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
  /** 右上角的数值可以直接改：点一下变成输入框，回车或离开时按范围和步长取整。 */
  editable?: boolean;
  /** 双击滑轨恢复成这个值。 */
  resetValue?: number;
  className?: string;
};

function snap(raw: number, min: number, max: number, step: number) {
  const stepped = Math.round((raw - min) / step) * step + min;
  // 步长是小数时去掉浮点误差（0.1 + 0.2 这类）
  const decimals = (String(step).split(".")[1] ?? "").length;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(decimals))));
}

function Slider({ label, value, onValueChange, min = 0, max = 100, step = 1, unit = "", format, disabled, editable, resetValue, className }: SliderProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = format ? format(value) : `${value}${unit}`;

  function commit() {
    if (draft === null) return;
    const n = Number(draft.trim());
    if (draft.trim() !== "" && Number.isFinite(n)) onValueChange(snap(n, min, max, step));
    setDraft(null);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <label id={`${id}-label`} className="text-ui text-ink">
          {label}
        </label>
        {editable ? (
          <span className="flex items-baseline font-num text-timecode text-ink-muted tabular-nums">
            <input
              type="text"
              inputMode="decimal"
              aria-label={`${label}数值`}
              disabled={disabled}
              value={draft ?? String(value)}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setDraft(null);
                  e.currentTarget.blur();
                }
              }}
              style={{ width: `${Math.max(2, (draft ?? String(value)).length) + 1}ch` }}
              className="rounded-xs border-0 bg-transparent p-0 text-right font-[inherit] text-[inherit] outline-none hover:bg-surface-raised focus:bg-surface-raised focus:text-ink"
            />
            {unit ? <span aria-hidden>{unit}</span> : null}
          </span>
        ) : (
          <output aria-hidden className="font-num text-timecode text-ink-muted tabular-nums">
            {shown}
          </output>
        )}
      </div>
      <SliderPrimitive.Root
        data-slot="slider"
        value={[value]}
        onValueChange={(v) => onValueChange(v[0] ?? min)}
        onDoubleClick={resetValue === undefined || disabled ? undefined : () => onValueChange(resetValue)}
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
