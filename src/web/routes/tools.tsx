import { ToolsPage } from "~/pages/ToolsPage";
import { pageMeta } from "~/shell/meta";

export const meta = () => pageMeta({ title: "小工具", description: "痕继痕迹写的小工具，打开就能用，多数工具只在你的浏览器里处理文件。" });

export default function Tools() {
  return <ToolsPage />;
}
