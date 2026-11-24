import { Dialog as DialogPrimitive } from "radix-ui";
import { Link } from "react-router";
import { DialogOverlay, DialogPortal } from "~/ui/dialog";
import { sitePages } from "./nav";

// 手机上的导航菜单：从顶部展开成整屏列表。按需加载，Radix Dialog 不进首页首屏的包。
export default function MobileMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 top-0 z-50 grid gap-1 rounded-b-xl bg-surface px-4 pt-4 pb-6 text-ink shadow-float outline-none data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[mist-in_var(--dur-base)_var(--ease-out)_both]"
        >
          <DialogPrimitive.Title className="sr-only">菜单</DialogPrimitive.Title>
          {sitePages.map((p) => (
            <Link
              key={p.path}
              to={p.path}
              viewTransition
              onClick={() => onOpenChange(false)}
              className="focus-ring flex h-13 items-center gap-3 rounded-md px-3 text-title-3 hover:bg-surface-raised"
            >
              <p.icon aria-hidden className="size-5 text-ink-muted" />
              {p.label}
            </Link>
          ))}
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
