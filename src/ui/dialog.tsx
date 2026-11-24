import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
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

function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-[min(440px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg bg-surface p-6 text-ink shadow-float outline-none data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[pop-in_var(--dur-base)_var(--ease-out)_both]",
          className,
        )}
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
