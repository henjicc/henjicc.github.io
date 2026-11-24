import { useState } from "react";
import type { VideosFile } from "~/content/schema";
import { Segmented } from "~/ui/segmented";
import { PageTop } from "./PageTop";
import { VideoItem } from "./VideoItem";

type Sort = "new" | "hot";

const sortOptions = [
  { value: "new", label: "最新" },
  { value: "hot", label: "最多播放" },
] as const;

// 目前只有视频。摄影上线时再按类别切换（开发方案第 4 节、第 10 节第 6 阶段）。
export function WorksPage({ data }: { data: VideosFile }) {
  const { videos } = data;
  const [sort, setSort] = useState<Sort>("new");
  // 数据本来就按发布时间倒序
  const list = sort === "new" ? videos : [...videos].sort((a, b) => b.views - a.views);
  return (
    <div className="wrap">
      <PageTop title="作品" lead={`最近 ${videos.length} 期`}>
        <Segmented label="排序" value={sort} onValueChange={setSort} options={sortOptions} />
      </PageTop>
      <div className="grid animate-mist-in gap-x-6 gap-y-8 [animation-delay:40ms] sm:grid-cols-2 md:gap-y-10 min-[68.75rem]:grid-cols-3">
        {list.map((v, i) => (
          <VideoItem key={v.bvid} video={v} fetchedAt={data.fetchedAt} eager={i < 3} sizes="(min-width: 1100px) 384px, (min-width: 640px) 50vw, 100vw" />
        ))}
      </div>
    </div>
  );
}
