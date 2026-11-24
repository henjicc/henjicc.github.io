import { site } from "~/content/site";
import { Logo } from "~/ui/logo";
import { ExternalLink } from "./links";

export function Footer() {
  return (
    <footer className="wrap mt-20 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-8 pb-12 text-caption text-ink-muted md:mt-28">
      <div className="flex items-center gap-3 text-ui font-semibold text-ink">
        <Logo size={20} />
        {site.name}
      </div>
      <nav aria-label="平台" className="flex flex-wrap gap-5">
        {site.social.map((link) => (
          <ExternalLink key={link.id} link={link} className="focus-ring inline-flex items-center rounded-xs hover:text-sky-text max-md:min-h-11" />
        ))}
      </nav>
      {/* 注明字体是 MiSans 许可的要求。年份在预渲染和访问时可能跨年，不算错误。 */}
      <span className="md:ml-auto" suppressHydrationWarning>
        字体：MiSans · © {new Date().getFullYear()} {site.name}
      </span>
    </footer>
  );
}
