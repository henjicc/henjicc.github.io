import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router";
import { site } from "~/content/site";
import { ExternalLink } from "~/shell/links";
import { Button } from "~/ui/button";
import { sceneStyle } from "./scene";
import { ToolGrid } from "./ToolGrid";

// 首页的骨架版：首屏（场景照片 + 名字 + 介绍 + 关注）和小工具。最近的视频、数据条、最新一期窗口在第 2 阶段补上。
export function HomePage() {
  const [bili, ...others] = site.social;
  return (
    <>
      <section className="scene overflow-hidden pb-20 md:pb-28" style={sceneStyle}>
        <div aria-hidden className="fog" />
        <div aria-hidden className="fog [animation-direction:alternate-reverse] [animation-duration:66s]" />
        <div className="wrap relative z-1 pt-32 md:pt-50">
          <h1 className="m-0 animate-mist-in text-[56px] leading-none font-extrabold tracking-[0.02em] text-on-scene md:text-hero">{site.name}</h1>
          <p className="mt-5 mb-0 max-w-[30em] animate-mist-in text-body-lg text-on-scene-muted [animation-delay:40ms]">{site.tagline}</p>
          <div className="mt-10 flex animate-mist-in flex-wrap gap-3 [animation-delay:80ms]">
            {bili ? (
              <Button asChild variant="primary" size="lg">
                <ExternalLink link={bili}>
                  去 B 站看看
                  <ArrowUpRight aria-hidden />
                </ExternalLink>
              </Button>
            ) : null}
            {others.map((link) => (
              <Button key={link.id} asChild variant="mist" size="lg">
                <ExternalLink link={link} />
              </Button>
            ))}
          </div>
        </div>
      </section>
      <div className="wrap">
        <section className="pt-20 md:pt-28">
          <div className="mb-8 flex flex-wrap items-baseline gap-4">
            <h2 className="m-0 text-title-2 md:text-title-1">小工具</h2>
            <Link to="/tools/" viewTransition className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-xs text-ui text-sky-text">
              工具箱
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <ToolGrid />
        </section>
      </div>
    </>
  );
}
