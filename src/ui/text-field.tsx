import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import type * as React from "react";
import { Input } from "~/ui/input";
import { cn } from "~/ui/lib/utils";

type TextFieldProps = Omit<React.ComponentProps<"input">, "onChange"> & {
  label: string;
  icon?: LucideIcon;
  /** 校验错误：说清原因和办法。 */
  error?: string;
  onChange?: (value: string, event: React.ChangeEvent<HTMLInputElement>) => void;
};

function TextField({ label, icon: Icon, error, className, id, onChange, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={inputId} className="text-ui text-ink">
        {label}
      </label>
      <div className="relative flex items-center">
        {Icon ? <Icon aria-hidden className="pointer-events-none absolute left-3 size-4 text-ink-muted" /> : null}
        <Input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={Icon ? "pl-9" : undefined}
          onChange={(e) => onChange?.(e.target.value, e)}
          {...props}
        />
      </div>
      {error ? (
        <p id={errorId} className="m-0 text-caption text-ember">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { TextField };
