import { RadioGroup } from "radix-ui";
import { cn } from "~/ui/lib/utils";

type Swatch = { value: string; name: string };

// 色块的颜色是用户要用的内容色（如水印颜色），不是界面颜色，所以由调用方传入。
function Swatches({
  label,
  value,
  onValueChange,
  colors,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  colors: readonly Swatch[];
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={onValueChange}
      orientation="horizontal"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {colors.map((c) => (
        <RadioGroup.Item
          key={c.value}
          value={c.value}
          aria-label={c.name}
          style={{ background: c.value }}
          className="size-8 cursor-pointer rounded-sm border border-line-strong p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring data-[state=checked]:outline-2 data-[state=checked]:outline-offset-2 data-[state=checked]:outline-focus-ring"
        />
      ))}
    </RadioGroup.Root>
  );
}

export { Swatches, type Swatch };
