import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { DialogOverlay, DialogPortal, useReturnFocus } from "~/ui/dialog";
import { Kbd } from "~/ui/kbd";
import { cn } from "~/ui/lib/utils";

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn("w-full overflow-hidden rounded-lg bg-surface text-ink shadow-float", className)}
      {...props}
    />
  );
}

/** 命令面板的弹层：从视口上方 12% 处出现。 */
function CommandDialog({
  open,
  onOpenChange,
  label,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
}) {
  const focus = useReturnFocus({});
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          {...focus}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(620px,calc(100%-32px))] -translate-x-1/2 outline-none data-[state=closed]:animate-[fade-out_var(--dur-quick)_var(--ease-in)_both] data-[state=open]:animate-[pop-in_var(--dur-base)_var(--ease-out)_both]"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <Command label={label} {...props}>
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex h-14 items-center gap-3 border-b border-line px-5">
      <Search aria-hidden className="size-[18px] text-ink-muted" />
      <CommandPrimitive.Input
        className={cn("h-full min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint", className)}
        {...props}
      />
      <Kbd>Esc</Kbd>
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  // 面板从 12vh 开始，底部留约 5vh，再减去输入框和页脚的高度
  return <CommandPrimitive.List className={cn("max-h-[min(640px,calc(83dvh-100px))] overflow-auto overscroll-contain p-2", className)} {...props} />;
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty className={cn("px-4 py-8 text-center text-ui text-ink-muted", className)} {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "**:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1 **:[[cmdk-group-heading]]:text-micro **:[[cmdk-group-heading]]:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "flex h-11 cursor-pointer items-center gap-3 rounded-sm border border-transparent px-3 text-ui font-normal text-ink select-none data-[selected=true]:border-sky-line data-[selected=true]:bg-sky-soft data-[selected=true]:text-sky-text [&_svg]:size-[18px] [&_svg]:text-ink-muted data-[selected=true]:[&_svg]:text-sky-text",
        className,
      )}
      {...props}
    />
  );
}

/** 条目右侧的元信息，如视频时长。 */
function CommandMeta({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("ml-auto flex-none text-caption text-ink-muted tabular-nums", className)} {...props} />;
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex gap-5 border-t border-line px-5 py-3 text-micro text-ink-muted [&>span]:inline-flex [&>span]:items-center [&>span]:gap-1.5", className)}
      {...props}
    />
  );
}

export { Command, CommandDialog, CommandEmpty, CommandFooter, CommandGroup, CommandInput, CommandItem, CommandList, CommandMeta };
