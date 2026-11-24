import { ArrowUpRight } from "lucide-react";
import type { VideosFile } from "~/content/schema";
import { site } from "~/content/site";
import { ExternalLink } from "~/shell/links";
import { Button } from "~/ui/button";
import { ChannelStats } from "./ChannelStats";
import { PageTop } from "./PageTop";

// 只放旧站点和设计稿里已有的内容：一句介绍、频道数据、各平台主页。设备清单、联系方式等作者没给出的信息不写。
export function AboutPage({ profile }: { profile: VideosFile["profile"] }) {
  const [bili, ...others] = site.social;
  return (
    <div className="wrap">
      <PageTop title="关于" />
      <div className="grid max-w-[36em] animate-mist-in gap-10 [animation-delay:40ms]">
        <p className="m-0 text-body-lg">
          {site.name}，{site.tagline}
        </p>
        <ChannelStats profile={profile} />
        <section className="grid gap-5">
          <h2 className="m-0 text-title-3">关注我</h2>
          <div className="flex flex-wrap gap-3">
            {bili ? (
              <Button asChild variant="primary">
                <ExternalLink link={bili}>
                  {bili.label}
                  <ArrowUpRight aria-hidden />
                </ExternalLink>
              </Button>
            ) : null}
            {others.map((link) => (
              <Button key={link.id} asChild>
                <ExternalLink link={link} />
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
