import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "~/ui/lib/utils";

// 一个视图里只有一个 primary。按钮不做胶囊形、不做渐变；加载时把文字换成进度，不换成转圈图标。
const buttonVariants = cva(
  "press focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border border-transparent font-medium leading-none select-none disabled:cursor-not-allowed disabled:text-ink-faint [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "border-0 bg-sky font-semibold text-on-sky shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:not-disabled:brightness-106 hover:not-disabled:shadow-[inset_0_1px_0_rgb(255_255_255/0.35),var(--shadow-glow)] disabled:bg-surface-raised disabled:shadow-none",
        secondary: "border-line bg-surface-raised text-ink hover:not-disabled:border-line-strong",
        ghost: "bg-transparent text-ink hover:not-disabled:bg-surface-raised",
        mist: "border-mist-line bg-mist text-on-scene shadow-inner-light backdrop-blur-(--blur-mist) hover:not-disabled:bg-mist-strong",
        danger: "border-line bg-transparent text-ember hover:not-disabled:border-transparent hover:not-disabled:bg-ember-soft",
      },
      size: {
        sm: "h-8 rounded-sm px-3 text-caption [&_svg]:size-4",
        md: "h-10 rounded-md px-4 text-ui [&_svg]:size-[18px]",
        lg: "h-12 rounded-md px-6 text-body [&_svg]:size-[18px]",
      },
      done: { true: "text-moss" },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({ className, variant, size, done, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, done, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants, type ButtonProps };
