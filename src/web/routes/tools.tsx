import { ToolsPage } from "~/pages/ToolsPage";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({ title: "小工具", description: "痕继痕迹写的小工具，处理都在你的浏览器里完成，不上传任何文件。" });

export default function Tools() {
  return <ToolsPage />;
}
