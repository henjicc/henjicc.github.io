import { useLoaderData } from "react-router";
import { videoFile } from "~/content/video-data";
import { WorksPage } from "~/pages/WorksPage";
import { pageMeta } from "~/shell/meta";

// 不用 ./+types/works：不显示视频时这条路由不注册（见 routes.ts），typegen 不会生成它的类型，类型检查会报错。
export const meta = () => pageMeta({ title: "作品" });

// 预渲染时运行，视频数据随页面发出去，不进 JS 包
export function loader() {
  return videoFile;
}

export default function Works() {
  return <WorksPage data={useLoaderData<typeof loader>()} />;
}
