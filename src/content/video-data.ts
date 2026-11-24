// 视频快照只在构建时读：路由的 loader 在预渲染时运行，数据随 HTML 和 .data 文件发出去，不打进 JS 包。
// 结构校验在 react-router.config.ts（构建）和 videos.test.ts 里跑。
import type { VideosFile } from "./schema";
import data from "./videos.json";

export const videoFile = data as VideosFile;
