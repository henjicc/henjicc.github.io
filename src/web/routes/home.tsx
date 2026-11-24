import { showVideos } from "~/content/site";
import { videoFile } from "~/content/video-data";
import { HomePage } from "~/pages/HomePage";
import type { ShellHandle } from "~/shell/handle";
import { pageMeta } from "~/shell/meta";
import type { Route } from "./+types/home";

export const meta = () => pageMeta({});
export const handle: ShellHandle = { header: "scene" };

// 预渲染时运行：首页只用到最新一期和最近 6 期，其余视频不随首页发出去；不显示视频时一期也不发
export function loader() {
  return { ...videoFile, videos: showVideos ? videoFile.videos.slice(0, 7) : [] };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <HomePage data={loaderData} />;
}
