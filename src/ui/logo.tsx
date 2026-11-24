import { LOGO_PATH, LOGO_VIEWBOX } from "~/ui/logo-path";
import { cn } from "~/ui/lib/utils";

// 单色“C”形线框，颜色跟随文字。不改形状、不加渐变和发光。
function Logo({ size = 22, title, className }: { size?: number; title?: string; className?: string }) {
  return (
    <svg
      className={cn("block flex-none", className)}
      width={Math.round((size * LOGO_VIEWBOX.width) / LOGO_VIEWBOX.height)}
      height={size}
      viewBox={`0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path fill="currentColor" fillRule="evenodd" d={LOGO_PATH} />
    </svg>
  );
}

export { Logo };
