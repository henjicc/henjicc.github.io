import type { VideosFile } from "~/content/schema";
import { formatCount } from "~/content/videos";
import { cn } from "~/ui/lib/utils";
import { Stat } from "~/ui/stat";

/** 粉丝、获赞、播放，中间用竖线隔开。只放构建时拉到的真实数字，拿不到的那项不显示。 */
export function ChannelStats({ profile, onScene = false, className }: { profile: VideosFile["profile"]; onScene?: boolean; className?: string }) {
  const items = [
    { label: "粉丝", value: profile.followers },
    { label: "获赞", value: profile.likes },
    { label: "播放", value: profile.totalViews },
  ].filter((s): s is { label: string; value: number } => s.value !== null);
  return (
    <div className={cn("flex flex-wrap", className)}>
      {items.map((s) => (
        <Stat
          key={s.label}
          value={formatCount(s.value)}
          label={s.label}
          // 手机上三项要并排放下，数字缩到 21px（设计稿手机版首页的取值）
          className={cn(
            "mr-3 border-r pr-3 last:mr-0 last:border-r-0 last:pr-0 md:mr-8 md:pr-8 [&>:first-child]:text-[21px] md:[&>:first-child]:text-stat",
            // 雾层竖线只用在照片上，实心底色上用普通分隔线
            onScene ? "border-mist-line" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
