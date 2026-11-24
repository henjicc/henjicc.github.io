import { PageTop } from "./PageTop";
import { ToolGrid } from "./ToolGrid";

export function ToolsPage() {
  return (
    <div className="wrap">
      <PageTop title="小工具" lead="处理都在你的浏览器里完成，不上传任何文件。" />
      <ToolGrid className="animate-mist-in [animation-delay:40ms]" />
    </div>
  );
}
