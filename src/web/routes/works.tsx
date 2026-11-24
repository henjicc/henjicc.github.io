import { videoFile } from "~/content/video-data";
import { WorksPage } from "~/pages/WorksPage";
import { pageMeta } from "~/shell/meta";
import type { Route } from "./+types/works";

export const meta = () => pageMeta({ title: "作品" });

// 预渲染时运行，视频数据随页面发出去，不进 JS 包
export function loader() {
  return videoFile;
}

export default function Works({ loaderData }: Route.ComponentProps) {
  return <WorksPage data={loaderData} />;
}
