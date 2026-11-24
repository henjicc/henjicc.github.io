import { Play } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "~/ui/lib/utils";

type VideoCardProps = {
  title: string;
  href: string;
  /** 封面图地址；没有时显示品牌色占位。 */
  cover?: string;
  /** 已格式化的时长，如“05:56”。 */
  duration?: string;
  /** 已格式化的播放量，如“68.9万”。 */
  views?: string;
  /** 已格式化的日期，如“10月31日”。 */
  date?: string;
  variant?: "default" | "feature" | "row";
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
};

function VideoCard({ title, href, cover, duration, views, date, variant = "default", onClick, className }: VideoCardProps) {
  const row = variant === "row";
  const meta = [views ? `${views} 播放` : null, date].filter(Boolean).join(" · ");
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className={cn(
        "group grid content-start gap-3 text-ink outline-none in-[.scene]:text-on-scene in-[.mist-panel]:text-on-scene",
        row && "grid-cols-[128px_1fr] items-center",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-video max-w-full overflow-hidden bg-surface-raised group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus-ring",
          row ? "rounded-sm" : "rounded-md",
        )}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-(--dur-gentle) ease-out group-hover:scale-104"
          />
        ) : (
          <div aria-hidden className="absolute inset-0 bg-forest" />
        )}
        {row ? null : (
          <span className="absolute top-1/2 left-1/2 z-1 -mt-[26px] -ml-[26px] grid size-[52px] scale-90 place-items-center rounded-full bg-sky text-on-sky opacity-0 shadow-[0_6px_20px_rgb(0_0_0/0.3)] transition-[opacity,scale] duration-(--dur-base) ease-out group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100">
            <Play aria-hidden className="size-5 fill-current stroke-none" />
          </span>
        )}
        {duration ? (
          // 角标压在封面照片上，两套主题都用同一组深底浅字
          <span className="absolute right-2.5 bottom-2 z-1 rounded-xs bg-[rgb(8_12_10/0.72)] px-1.5 py-0.5 font-num text-micro text-[#f4f7f5] tabular-nums">
            {duration}
          </span>
        ) : null}
      </div>
      <div className="grid min-w-0 gap-1">
        <h3
          className={cn(
            "m-0 line-clamp-2 text-balance",
            variant === "feature" ? "text-[22px] leading-[1.35] font-bold" : row ? "text-ui" : "text-[16px] leading-[1.45] font-semibold",
          )}
        >
          {title}
        </h3>
        {meta ? (
          <p className="m-0 text-caption text-ink-muted tabular-nums in-[.mist-panel]:text-on-scene-muted in-[.scene]:text-on-scene-muted">
            {meta}
          </p>
        ) : null}
      </div>
    </a>
  );
}

export { VideoCard };
