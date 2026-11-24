import { site } from "~/content/site";

/** 路由模块的 meta：页面标题统一是“<页面> · 痕继痕迹”，首页只有站名。 */
export function pageMeta({ title, description }: { title?: string; description?: string }) {
  return [
    { title: title ? `${title} · ${site.name}` : `${site.name} - ${site.tagline}` },
    { name: "description", content: description ?? site.tagline },
  ];
}
