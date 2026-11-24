import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// 轻提示：从底部上移淡入，4 秒后淡出，同一时间最多两条。状态写结果（“已复制”），出错说清原因和办法。
// 调用方用 sonner 的 toast()：toast("已恢复默认")、toast.success("已导出 3 张")、toast.warning(...)、toast.error(...)。
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      visibleToasts={2}
      duration={4000}
      gap={8}
      icons={{
        success: <CircleCheck aria-hidden className="size-[18px] text-moss" />,
        info: <Info aria-hidden className="size-[18px] text-ink-muted" />,
        warning: <TriangleAlert aria-hidden className="size-[18px] text-amber" />,
        error: <TriangleAlert aria-hidden className="size-[18px] text-ember" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-md bg-surface py-3 pr-3 pl-4 text-ink shadow-float font-[inherit]",
          icon: "mt-[3px] flex-none",
          content: "min-w-0 flex-1 pt-px",
          title: "m-0 text-ui",
          description: "mt-0.5 text-caption text-ink-muted [overflow-wrap:anywhere]",
          actionButton:
            "focus-ring h-7 flex-none max-md:h-11 cursor-pointer rounded-sm border-0 bg-transparent px-2 text-caption font-semibold text-sky-text hover:bg-sky-soft",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
