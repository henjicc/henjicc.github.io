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

export type SiteLink = z.infer<typeof siteLinkSchema>;
export type SiteContent = z.infer<typeof siteSchema>;
