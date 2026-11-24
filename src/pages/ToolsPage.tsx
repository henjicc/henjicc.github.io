import { PageTop } from "./PageTop";
import { ToolGrid } from "./ToolGrid";

export function ToolsPage() {
  return (
    <div className="wrap">
      {/* 不是每个工具都只在本地处理（批量文本处理要调接口），文件去哪由各工具页脚说明 */}
      <PageTop title="小工具" lead="打开就能用，多数工具只在你的浏览器里处理文件。" />
      <ToolGrid className="animate-mist-in [animation-delay:40ms]" />
    </div>
  );
}
