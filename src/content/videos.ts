// 视频的显示格式。数据本身只在路由的 loader 里读（见 video-data.ts），不进浏览器的 JS 包。
import type { Video } from "./schema";

export const videoUrl = (v: Pick<Video, "bvid">) => `https://www.bilibili.com/video/${v.bvid}/`;

/**
 * B 站图床按地址后缀出缩略图（16:9 裁切填满，webp）。
 * 图床对第三方 Referer 返回 403，所以 <img> 必须带 referrerpolicy="no-referrer"（VideoCard 里写死了）。
 */
export function coverImage(v: Pick<Video, "cover">) {
  return {
    src: `${v.cover}@672w_378h_1c.webp`,
    srcSet: `${v.cover}@336w_189h_1c.webp 336w, ${v.cover}@672w_378h_1c.webp 672w`,
  };
}

/** 68.9万、1.2亿；不到一万原样显示。 */
export function formatCount(n: number): string {
  // 先按一位小数取整再选单位：99,999,600 按万算会进位成 10000万，应该显示 1亿
  const wan = Math.round(n / 1e3) / 10;
  if (wan >= 1e4) return `${Math.round(n / 1e7) / 10}亿`;
  if (n >= 1e4) return `${wan}万`;
  return String(n);
}

/** 05:56；超过一小时写成 1:02:03。 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// 日期按北京时间算，不跟访客时区走：预渲染的 HTML 和浏览器水合后必须一致。
const BEIJING = 8 * 3600 * 1000;

/** 10月31日；和 now（数据拉取时间）不在同一年时带上年份。 */
export function formatDate(iso: string, now: string): string {
  const d = new Date(Date.parse(iso) + BEIJING);
  const year = new Date(Date.parse(now) + BEIJING).getUTCFullYear();
  const md = `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return d.getUTCFullYear() === year ? md : `${d.getUTCFullYear()}年${md}`;
}
