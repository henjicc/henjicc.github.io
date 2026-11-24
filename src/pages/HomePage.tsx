import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { showChannelStats, showVideos, site } from "~/content/site";
import type { VideosFile } from "~/content/schema";
import { formatDate } from "~/content/videos";
import { ExternalLink } from "~/shell/links";
import { tools } from "~/tools/registry";
import { Button } from "~/ui/button";
import { cn } from "~/ui/lib/utils";
import { MistPanel } from "~/ui/mist-panel";
import { ChannelStats } from "./ChannelStats";
import { sceneStyle } from "./scene";
import { ToolGrid } from "./ToolGrid";
import { VideoItem } from "./VideoItem";

// 显示视频时首屏两栏（介绍 | 最新一期），在 1100px 以下改成单栏，和设计稿的断点一致。
// 断点写成 68.75rem：和 md（48rem）同一单位，Tailwind 才能把它排在 md 后面，否则 md:grid-cols-2 会盖过它。
// 不显示视频时只有介绍一栏，靠左压在照片下部，右边留给雾林；顶部加高，场景照片不至于只剩一条。
// 视频相关的分支都直接判断 showVideos 常量：关掉时打包会把视频卡片的代码一起去掉，首页的包更小。
export function HomePage({ data }: { data: VideosFile }) {
  const [bili, ...others] = site.social;
  const [latest, ...recent] = data.videos;
  const live = tools.filter((t) => t.status === "live").length;
  const plan = tools.length - live;
  const feature = showVideos && latest;
  return (
    <>
      <section className="scene pb-16 md:pb-28" style={sceneStyle}>
        <div aria-hidden className="fog" />
        <div
          className={cn(
            "wrap relative z-1 grid items-end gap-8 md:gap-12",
            feature
              ? "pt-32 md:pt-40 min-[68.75rem]:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] min-[68.75rem]:gap-18 min-[68.75rem]:pt-50"
              : "pt-40 md:pt-56 min-[68.75rem]:pt-72",
          )}
        >
          <div>
            <h1 className="m-0 animate-mist-in text-[56px] leading-none font-extrabold tracking-[0.02em] text-on-scene md:text-hero">{site.name}</h1>
            <p className="mt-3 mb-0 max-w-[30em] animate-mist-in text-body-lg text-on-scene-muted [animation-delay:40ms] md:mt-5">{site.tagline}</p>
            {showChannelStats ? <ChannelStats profile={data.profile} onScene className="mt-6 animate-mist-in [animation-delay:80ms] md:mt-10" /> : null}
            <div className="mt-6 grid animate-mist-in grid-cols-3 gap-2 [animation-delay:120ms] md:mt-10 md:flex md:flex-wrap md:gap-3">
              {bili ? (
                <Button asChild variant="primary" size="lg" className="col-span-full">
                  <ExternalLink link={bili}>
                    去 B 站看看
                    <ArrowUpRight aria-hidden />
                  </ExternalLink>
                </Button>
              ) : null}
              {others.map((link) => (
                <Button key={link.id} asChild variant="mist" size="lg" className="px-3 md:px-6">
                  <ExternalLink link={link} />
                </Button>
              ))}
            </div>
          </div>
          {feature ? (
            <MistPanel className="grid animate-mist-in gap-3 p-4 [animation-delay:160ms] md:gap-4 md:p-5">
              <div className="flex items-baseline justify-between text-caption text-on-scene-muted">
                <b className="text-ui font-semibold text-on-scene">最新一期</b>
                <span>{formatDate(latest.publishedAt, data.fetchedAt)} 发布</span>
              </div>
              <VideoItem video={latest} fetchedAt={data.fetchedAt} variant="feature" eager sizes="(min-width: 1100px) 540px, 100vw" />
            </MistPanel>
          ) : null}
        </div>
      </section>
      <div className="wrap">
        {showVideos && recent.length ? (
          <Section title="最近的视频" link={{ to: "/works/", label: "全部视频" }}>
            {/* 手机上横向滑动并按卡片吸附，左右贴到屏幕边。桌面上第一张跨两列做大卡：
                三列时再跨两行，六张正好排满三行；两列时第一张占满一行，最后一张藏起来免得单独剩半行 */}
            <div className="-mx-4 grid snap-x snap-mandatory scroll-px-4 auto-cols-[264px] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:auto-cols-auto md:grid-flow-row md:grid-cols-2 md:gap-x-6 md:gap-y-10 md:overflow-visible md:px-0 md:pb-0 min-[68.75rem]:grid-cols-3">
              {recent.slice(0, 6).map((v, i) => (
                <VideoItem
                  key={v.bvid}
                  video={v}
                  fetchedAt={data.fetchedAt}
                  className={cn(
                    "snap-start",
                    i === 0 && "md:col-span-2 md:[&_h3]:text-title-3 min-[68.75rem]:row-span-2",
                    i === 5 && "md:max-[68.75rem]:hidden",
                  )}
                  sizes={i === 0 ? "(min-width: 768px) 792px, 264px" : "(min-width: 1100px) 384px, (min-width: 768px) 50vw, 264px"}
                />
              ))}
            </div>
          </Section>
        ) : null}
        <Section title="小工具" note={`${live} 个可用${plan ? ` · ${plan} 个计划中` : ""}`} link={{ to: "/tools/", label: "工具箱" }}>
          <ToolGrid />
        </Section>
      </div>
    </>
  );
}

function Section({ title, note, link, children }: { title: string; note?: string; link: { to: string; label: string }; children: ReactNode }) {
  return (
    <section className="pt-20 md:pt-28">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 md:mb-8">
        <h2 className="m-0 text-title-2 md:text-title-1">{title}</h2>
        {note ? <span className="text-ui font-normal text-ink-muted">{note}</span> : null}
        <Link to={link.to} viewTransition className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-xs text-ui text-sky-text max-md:min-h-11">
          {link.label}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}
