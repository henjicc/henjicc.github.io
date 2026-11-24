import type { SiteContent, SiteLink } from "./schema";

// 作者公开的主页地址，属于网站内容（原来写在旧首页的“关注我”弹窗里）。
export const biliSpace: SiteLink = {
  id: "bilibili",
  label: "哔哩哔哩",
  href: "https://space.bilibili.com/39337803",
  bili: { type: "space", id: "39337803" },
};

/**
 * 网站上显示哪些内容。2026-11-24 作者决定暂时不在网站上放视频，改回 true 即恢复：
 * 作品页 /works/ 和它的导航入口、首页的最新一期和最近的视频、命令面板的视频组。
 * 关闭时 /works/ 不注册路由，构建不生成它，访问落到 404。视频数据和每天的拉取照旧，频道数据还要用。
 */
export const showVideos: boolean = false;
/** 首页和关于页的频道数据（粉丝、获赞、播放）。 */
export const showChannelStats: boolean = true;

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
