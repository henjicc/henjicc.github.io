import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "~/ui/button";
import { cn } from "~/ui/lib/utils";

type IconButtonProps = Omit<ButtonProps, "children" | "asChild"> & {
  icon: LucideIcon;
  /** 没有文字，所以必须给无障碍标签。 */
  label: string;
};

function IconButton({ icon: Icon, label, variant = "ghost", size = "md", className, ...props }: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      variant={variant}
      size={size}
      className={cn("px-0", size === "sm" ? "w-8 max-md:w-11" : size === "lg" ? "w-12" : "w-10 max-md:w-11", className)}
      {...props}
    >
      <Icon aria-hidden />
    </Button>
  );
}

export { IconButton };
