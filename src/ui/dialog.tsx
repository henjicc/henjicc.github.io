import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef } from "react";
import type * as React from "react";
import { IconButton } from "~/ui/icon-button";
import { cn } from "~/ui/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

// 遮罩淡入 dur-quick；面板从 0.97 放大到 1、模糊 4px→0，dur-base。
function DialogOverlay({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-[rgb(5_8_7/0.55)] data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[fade-in_var(--dur-quick)_var(--ease-out)_both]",
        className,
      )}
      {...props}
    />
  );
}

/**
 * 关闭后把焦点还给打开前的元素。Radix 只会还给 <DialogTrigger>；受控打开（open 属性）的弹窗没有 Trigger，
 * 焦点会掉到 body 上，键盘用户得从页面开头重新 Tab。打开前的元素已经不在页面上时交回 Radix 的默认处理。
 */
export function useReturnFocus<E extends Event>(handlers: { onOpenAutoFocus?: (e: E) => void; onCloseAutoFocus?: (e: E) => void }) {
  const returnTo = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus(e: E) {
      // 此时焦点还没移进弹窗
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      handlers.onOpenAutoFocus?.(e);
    },
    onCloseAutoFocus(e: E) {
      handlers.onCloseAutoFocus?.(e);
      const el = returnTo.current;
      returnTo.current = null;
      if (e.defaultPrevented || !el?.isConnected) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
    },
  };
}

// 面板贴在视口上方 10% 处：内容变多时往下长，标题不会跟着跳。手机上改成从底部升起的抽屉。
// 最大高度用 !：调用方常传自己的 max-h 按居中算，贴顶后要留出上方 10vh，否则底部会超出屏幕。
function DialogContent({
  className,
  children,
  showClose = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-[10vh] left-1/2 z-50 grid max-h-[calc(90dvh-16px)]! w-[min(440px,calc(100%-32px))] -translate-x-1/2 gap-4 overflow-auto overscroll-contain rounded-lg bg-surface p-6 text-ink shadow-float outline-none data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[pop-in_var(--dur-base)_var(--ease-out)_both]",
          "max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-h-[90dvh]! max-md:w-full! max-md:translate-x-0 max-md:rounded-b-none max-md:rounded-t-xl max-md:pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] max-md:data-[state=open]:animate-[sheet-in_var(--dur-gentle)_var(--ease-out)_both]",
          className,
        )}
        {...focus}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton icon={X} label="关闭" size="sm" className="absolute top-3 right-3" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("m-0 text-title-3", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("m-0 text-body text-ink-muted", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger };
