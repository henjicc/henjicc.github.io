import { site } from "~/content/site";
import { ExternalLink } from "~/shell/links";
import { Button } from "~/ui/button";
import { PageTop } from "./PageTop";

// 骨架版：介绍、设备、联系方式在第 2 阶段补上。
export function AboutPage() {
  return (
    <div className="wrap">
      <PageTop title="关于" />
      <div className="grid max-w-[36em] animate-mist-in gap-6 [animation-delay:40ms]">
        <p className="m-0 text-body-lg">{site.tagline}</p>
        <div className="flex flex-wrap gap-3">
          {site.social.map((link) => (
            <Button key={link.id} asChild>
              <ExternalLink link={link} />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
