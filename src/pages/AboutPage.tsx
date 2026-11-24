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
        {/* LGPL 要求注明用到的库和它的许可证、给出源码地址；MiSans 的许可要求注明字体 */}
        <section className="grid gap-2 text-caption text-ink-muted">
          <h2 className="m-0 text-ui font-semibold text-ink">开源许可</h2>
          <p className="m-0">
            水印工具用{" "}
            <a href="https://github.com/hoppergee/heic-to" target="_blank" rel="noreferrer" className="focus-ring rounded-xs text-sky-text underline-offset-2 hover:underline">
              heic-to
            </a>
            （LGPL-3.0）读取 HEIC 照片。
          </p>
          <p className="m-0">全站字体是小米的 MiSans。</p>
        </section>
      </div>
    </div>
  );
}
