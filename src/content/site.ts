import type { SiteContent, SiteLink } from "./schema";

// 作者公开的主页地址，属于网站内容（原来写在旧首页的“关注我”弹窗里）。
export const biliSpace: SiteLink = {
  id: "bilibili",
  label: "哔哩哔哩",
  href: "https://space.bilibili.com/39337803",
  bili: { type: "space", id: "39337803" },
};

export const site = {
  name: "痕继痕迹",
  tagline: "AI 科技区 UP 主。做视频，也写点趁手的小工具。",
  bilibiliUid: "39337803",
  social: [
    biliSpace,
    { id: "youtube", label: "YouTube", href: "https://www.youtube.com/@henji" },
    { id: "xiaohongshu", label: "小红书", href: "https://www.xiaohongshu.com/user/profile/5fb11f8c000000000101ee79" },
    { id: "douyin", label: "抖音", href: "https://v.douyin.com/iARkHnQ9/" },
  ],
} satisfies SiteContent;
