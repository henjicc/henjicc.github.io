// 内容数据的结构。校验在测试和构建里跑（zod 不进浏览器包），页面只用推导出的类型。
import { z } from "zod";

export const siteLinkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  href: z.url({ protocol: /^https$/ }),
  /** B 站内的页面：TOY 里改用 SDK 原生打开。 */
  bili: z.object({ type: z.enum(["video", "space", "opus"]), id: z.string().min(1) }).optional(),
});

export const siteSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().min(1),
  bilibiliUid: z.string().regex(/^\d+$/),
  social: z.array(siteLinkSchema).min(1),
});

// 视频数据（src/content/videos.json，由 scripts/fetch-videos.ts 生成）。只存页面用到的字段：
// 接口返回的简介里有联系方式，不进仓库。
export const videoSchema = z.object({
  bvid: z.string().regex(/^BV[0-9A-Za-z]{10}$/),
  title: z.string().min(1),
  /** https 原图地址，不带尺寸后缀；页面按需拼 @672w_378h_1c.webp 这类后缀。 */
  cover: z.string().regex(/^https:\/\/i\d\.hdslb\.com\/bfs\/archive\/[^@?]+\.(jpg|jpeg|png|webp)$/),
  /** 秒 */
  duration: z.number().int().positive(),
  views: z.number().int().nonnegative(),
  publishedAt: z.iso.datetime(),
});

export const videosFileSchema = z.object({
  fetchedAt: z.iso.datetime(),
  profile: z.object({
    followers: z.number().int().nonnegative(),
    likes: z.number().int().nonnegative(),
    /** 公开稿件播放合计（逐页累加，近似值）；拿不到时为 null，页面不显示这一项。 */
    totalViews: z.number().int().nonnegative().nullable(),
  }),
  videos: z
    .array(videoSchema)
    .min(1)
    .refine((list) => new Set(list.map((v) => v.bvid)).size === list.length, "bvid 有重复"),
});

export type SiteLink = z.infer<typeof siteLinkSchema>;
export type Video = z.infer<typeof videoSchema>;
export type VideosFile = z.infer<typeof videosFileSchema>;
export type SiteContent = z.infer<typeof siteSchema>;
