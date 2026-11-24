import { biliSpace, site } from "~/content/site";
import { ExternalLink } from "~/shell/links";
import { Button } from "~/ui/button";
import { ToolGrid } from "./ToolGrid";

// TOY 工具箱合集的首页：访客已经在 B 站里了，只放一句介绍、工具列表和关注入口。
export function ToyHomePage() {
  return (
    <div className="wrap pb-12">
      <div className="grid animate-mist-in gap-3 pt-10 pb-8">
        <h1 className="m-0 text-title-1">{site.name}的小工具</h1>
        <p className="m-0 text-body text-ink-muted">打开就能用，处理都在本地完成，不上传任何文件。</p>
      </div>
      <ToolGrid className="animate-mist-in [animation-delay:40ms]" />
      <Button asChild className="mt-8">
        <ExternalLink link={biliSpace}>去我的 B 站主页</ExternalLink>
      </Button>
    </div>
  );
}
