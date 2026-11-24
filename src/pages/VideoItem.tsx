import type { Video } from "~/content/schema";
import { coverImage, formatCount, formatDate, formatDuration, videoUrl } from "~/content/videos";
import { externalLinkProps } from "~/shell/links";
import { VideoCard } from "~/ui/video-card";

type VideoItemProps = {
  video: Video;
  /** 数据拉取时间：日期和它不在同一年时才写年份。 */
  fetchedAt: string;
  variant?: "default" | "feature";
  /** 封面在页面上的显示宽度，给浏览器挑 336 还是 672 宽的图。 */
  sizes: string;
  eager?: boolean;
  className?: string;
};

/** 一期视频：把数据换成 VideoCard 要的格式。TOY 里由平台适配层在 App 内打开视频。 */
export function VideoItem({ video, fetchedAt, variant, sizes, eager, className }: VideoItemProps) {
  const cover = coverImage(video);
  const link = externalLinkProps({ href: videoUrl(video), bili: { type: "video", id: video.bvid } });
  return (
    <VideoCard
      title={video.title}
      href={link.href}
      onClick={link.onClick}
      cover={cover.src}
      coverSrcSet={cover.srcSet}
      coverSizes={sizes}
      coverLoading={eager ? "eager" : "lazy"}
      duration={formatDuration(video.duration)}
      views={formatCount(video.views)}
      date={formatDate(video.publishedAt, fetchedAt)}
      variant={variant}
      className={className}
    />
  );
}
