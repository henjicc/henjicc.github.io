import { Moon, Sun } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Link, useLocation } from "react-router";
import { DialogOverlay, DialogPortal, useReturnFocus } from "~/ui/dialog";
import { cn } from "~/ui/lib/utils";
import { sitePages } from "./nav";
import { originOf, resolveTheme, toggleTheme, useThemeStore } from "./theme";

const row =
  "focus-ring flex h-13 w-full cursor-pointer items-center gap-3 rounded-md border border-transparent bg-transparent px-3 text-left text-title-3 text-ink hover:bg-surface-raised [&_svg]:size-5 [&_svg]:text-ink-muted";

// 手机上的导航菜单：从顶栏下方展开成整屏列表，顶栏留在上面（菜单按钮变成关闭）。按需加载，Radix Dialog 不进首页首屏的包。
// 手机顶栏只放 Logo、搜索和菜单，主题切换也在这里。
export default function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { pathname } = useLocation();
  const night = resolveTheme(useThemeStore((s) => s.choice)) === "night";
  const focus = useReturnFocus({});
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="top-16" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          {...focus}
          className="fixed inset-x-0 top-16 z-50 grid max-h-[calc(100dvh-64px)] gap-1 overflow-auto rounded-b-xl border-t border-line bg-surface px-4 pt-3 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] text-ink shadow-float outline-none data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[mist-in_var(--dur-base)_var(--ease-out)_both]"
        >
          <DialogPrimitive.Title className="sr-only">菜单</DialogPrimitive.Title>
          {sitePages.map((p) => {
            const current = p.path === "/" ? pathname === "/" : pathname.startsWith(p.path);
            return (
              <Link
                key={p.path}
                to={p.path}
                viewTransition
                aria-current={current ? "page" : undefined}
                onClick={() => onOpenChange(false)}
                className={cn(row, current && "border-sky-line bg-sky-soft text-sky-text hover:bg-sky-soft [&_svg]:text-sky-text")}
              >
                <p.icon aria-hidden />
                {p.label}
              </Link>
            );
          })}
          <div className="my-2 border-t border-line" />
          <button
            type="button"
            className={row}
            onClick={(e) => {
              const origin = originOf(e.currentTarget);
              onOpenChange(false);
              // 等菜单关掉再切，圆形扩散才不会把菜单也拍进去
              setTimeout(() => toggleTheme(origin), 0);
            }}
          >
            {night ? <Sun aria-hidden /> : <Moon aria-hidden />}
            切换到{night ? "晨雾" : "夜雾"}
          </button>
          <DialogPrimitive.Close className="sr-only">关闭菜单</DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
