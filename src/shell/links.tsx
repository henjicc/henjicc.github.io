import type { MouseEvent, ReactNode } from "react";
import type { SiteLink } from "~/content/schema";
import { platform } from "~/platform";
import { isToy } from "./env";

/**
 * 站外链接的属性：网站上是普通新窗口链接（能中键、能复制地址）；
 * TOY 里 B 站的页面改用 SDK 在 App 里原生打开。
 */
export function externalLinkProps(link: Pick<SiteLink, "href" | "bili">) {
  return {
    href: link.href,
    target: "_blank",
    rel: "noreferrer",
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isToy || !link.bili) return;
      event.preventDefault();
      void platform.openBili(link.bili.type, link.bili.id);
    },
  } as const;
}

export function ExternalLink({ link, className, children }: { link: SiteLink; className?: string; children?: ReactNode }) {
  return (
    <a className={className} {...externalLinkProps(link)}>
      {children ?? link.label}
    </a>
  );
}
