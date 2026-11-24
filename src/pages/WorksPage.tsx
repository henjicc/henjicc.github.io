import { ArrowUpRight } from "lucide-react";
import { biliSpace } from "~/content/site";
import { ExternalLink } from "~/shell/links";
import { Button } from "~/ui/button";
import { PageTop } from "./PageTop";

// 骨架版：视频列表在第 2 阶段由构建时拉取的数据填上。
export function WorksPage() {
  return (
    <div className="wrap">
      <PageTop title="作品" />
      <div className="grid animate-mist-in justify-items-start gap-5 rounded-lg bg-surface p-6 [animation-delay:40ms] md:p-10">
        <p className="m-0 text-body-lg">视频列表还在搬过来，先去 B 站看全部视频。</p>
        <Button asChild variant="primary">
          <ExternalLink link={biliSpace}>
            去 B 站看看
            <ArrowUpRight aria-hidden />
          </ExternalLink>
        </Button>
      </div>
    </div>
  );
}
