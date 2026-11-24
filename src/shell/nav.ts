import { Clapperboard, House, Info, Wrench, type LucideIcon } from "lucide-react";

export type SitePage = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 命令面板的额外匹配词（拼音首字母、英文）。 */
  keywords: string[];
  /** 是否出现在顶栏中间的导航里。 */
  inNav: boolean;
};

// 网站的栏目页。TOY 只放工具，不用这张表。
export const sitePages: SitePage[] = [
  { path: "/", label: "首页", icon: House, keywords: ["sy", "home"], inNav: false },
  { path: "/works/", label: "作品", icon: Clapperboard, keywords: ["zp", "works", "视频"], inNav: true },
  { path: "/tools/", label: "小工具", icon: Wrench, keywords: ["xgj", "gjx", "工具箱", "tools"], inNav: true },
  { path: "/about/", label: "关于", icon: Info, keywords: ["gy", "about"], inNav: true },
];
