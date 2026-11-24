// 水印设置的结构、默认值和改动规则。纯数据，不碰 React 和 DOM。
import { z } from "zod";

export const CELLS = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type Cell = (typeof CELLS)[number];
export type Position = Cell | "tile";

export const CELL_NAMES: Record<Cell, string> = {
  "top-left": "左上",
  "top-center": "上",
  "top-right": "右上",
  "middle-left": "左",
  center: "居中",
  "middle-right": "右",
  "bottom-left": "左下",
  "bottom-center": "下",
  "bottom-right": "右下",
};

// 内置字体只用几个常见族的回退链：手机和 TOY 上没有 Arial、微软雅黑，写死字体名会悄悄回退成别的样子。
export const FONTS = {
  hei: { label: "黑体", stack: '"Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' },
  song: { label: "宋体", stack: 'Georgia, "Times New Roman", "Songti SC", SimSun, "Noto Serif SC", serif' },
  kai: { label: "楷体", stack: '"Kaiti SC", STKaiti, KaiTi, "AR PL UKai CN", serif' },
  mono: { label: "等宽", stack: 'ui-monospace, "SF Mono", Consolas, "Courier New", monospace' },
} as const;
export type FontId = keyof typeof FONTS;
/** 本机字体（Local Font Access，只有桌面 Chromium 有）存成 local:<字体族名>。 */
export const LOCAL_FONT_PREFIX = "local:";

export function fontStack(font: string): string {
  if (font.startsWith(LOCAL_FONT_PREFIX)) return `"${font.slice(LOCAL_FONT_PREFIX.length).replaceAll('"', "")}", ${FONTS.hei.stack}`;
  return (FONTS[font as FontId] ?? FONTS.hei).stack;
}

export type SizeUnit = "percent" | "px";
export const SIZE_RANGE: Record<SizeUnit, { min: number; max: number }> = {
  percent: { min: 1, max: 100 },
  px: { min: 8, max: 800 },
};
export const OPACITY_RANGE = { min: 0.1, max: 1 };
/** 九宫格：在锚点基础上的偏移，按图片宽（水平）、高（垂直）的百分比，向右、向下为正。平铺：整张网格的平移，单位相同。 */
export const OFFSET_RANGE = { min: -100, max: 100 };
export const MAX_TEXT_LENGTH = 2000;
/** 平铺间隔按水印自身尺寸的百分比算：同一套设置在大小不同的照片上疏密一样。 */
export const SPACING_RANGE = { min: 0, max: 300 };
export const ROTATION_RANGE = { min: -180, max: 180 };
/** 选“平铺”时自动设成的角度。 */
export const TILE_ROTATION = -30;

const clampNum = (min: number, max: number, fallback: number) =>
  z
    .number()
    .refine(Number.isFinite)
    .transform((v) => Math.min(max, Math.max(min, v)))
    .catch(fallback);

export const FACTORY_MARK = {
  type: "text" as "text" | "image",
  text: "示例水印",
  markId: null as string | null,
  position: "center" as Position,
  offsetX: 0,
  offsetY: 0,
  spacingX: 50,
  spacingY: 50,
  size: 10,
  rotation: 0,
  opacity: 0.7,
  color: "#ffffff",
  font: "hei" as string,
};
export type MarkSettings = typeof FACTORY_MARK;

const HEX = /^#[0-9a-f]{6}$/i;

/** 读存储、导入预设都过一遍：缺字段、类型不对、超出范围的值换成默认，不让旧数据把界面弄坏。 */
export const markSettingsSchema = z.object({
  type: z.enum(["text", "image"]).catch(FACTORY_MARK.type),
  // 超长时截断而不是整段换成默认：用户的文字比示例水印更接近他想要的
  text: z
    .string()
    .transform((t) => t.slice(0, MAX_TEXT_LENGTH))
    .catch(FACTORY_MARK.text),
  markId: z.string().nullable().catch(null),
  position: z.enum([...CELLS, "tile"]).catch(FACTORY_MARK.position),
  offsetX: clampNum(OFFSET_RANGE.min, OFFSET_RANGE.max, 0),
  offsetY: clampNum(OFFSET_RANGE.min, OFFSET_RANGE.max, 0),
  spacingX: clampNum(SPACING_RANGE.min, SPACING_RANGE.max, FACTORY_MARK.spacingX),
  spacingY: clampNum(SPACING_RANGE.min, SPACING_RANGE.max, FACTORY_MARK.spacingY),
  size: clampNum(SIZE_RANGE.percent.min, SIZE_RANGE.px.max, FACTORY_MARK.size),
  rotation: clampNum(ROTATION_RANGE.min, ROTATION_RANGE.max, 0),
  opacity: clampNum(OPACITY_RANGE.min, OPACITY_RANGE.max, FACTORY_MARK.opacity),
  color: z.string().regex(HEX).catch(FACTORY_MARK.color),
  font: z.string().max(200).catch(FACTORY_MARK.font),
});

export function parseMarkSettings(value: unknown): MarkSettings {
  return markSettingsSchema.parse(value ?? {}) as MarkSettings;
}

export type ExportFormat = "auto" | "jpeg" | "png" | "webp";

export const FACTORY_APP = {
  /** “设为默认”存下的水印设置：新开图片、“恢复默认”都回到它。 */
  defaults: FACTORY_MARK,
  unit: "percent" as SizeUnit,
  useFilename: false,
  format: "auto" as ExportFormat,
  quality: 0.95,
};
export type AppSettings = typeof FACTORY_APP;

const appSettingsSchema = z.object({
  defaults: z.unknown().optional().transform(parseMarkSettings),
  unit: z.enum(["percent", "px"]).catch(FACTORY_APP.unit),
  useFilename: z.boolean().catch(FACTORY_APP.useFilename),
  format: z.enum(["auto", "jpeg", "png", "webp"]).catch(FACTORY_APP.format),
  quality: clampNum(0.1, 1, FACTORY_APP.quality),
});

export function parseAppSettings(value: unknown): AppSettings {
  return appSettingsSchema.parse(value && typeof value === "object" ? value : {}) as AppSettings;
}

/** 单位变了以后大小可能超出新单位的范围，夹回去。 */
export function clampSize(size: number, unit: SizeUnit): number {
  const r = SIZE_RANGE[unit];
  return Math.min(r.max, Math.max(r.min, size));
}

/** 选九宫格的格子时偏移归零，水印落在锚点上；选平铺时角度改成斜的，平铺一般都斜着放。 */
export function applyPosition(settings: MarkSettings, position: Position): MarkSettings {
  if (position === "tile") return { ...settings, position, rotation: TILE_ROTATION };
  return { ...settings, position, offsetX: 0, offsetY: 0 };
}

/**
 * 第 1 版存的位移：九宫格时 ±100 表示水印贴到图片边上（向上为正），选格子会把位移设成 ±100；平铺时是网格平移（也是向上为正）。
 * 换成第 2 版的“在锚点基础上的偏移”（图片宽高的百分比，向右、向下为正）。
 * 九宫格里不计水印自身大小近似换算：贴边的值正好变成 0，落在新锚点上；手动调过的值换算后位置大致不变。
 */
export function migrateOffsetsV1(s: MarkSettings): MarkSettings {
  // `|| 0` 把 -0 换成 0，滑块上不显示“-0”
  const clamp = (v: number) => Math.min(OFFSET_RANGE.max, Math.max(OFFSET_RANGE.min, v)) || 0;
  if (s.position === "tile") return { ...s, offsetY: clamp(-s.offsetY) };
  const anchorX = s.position.endsWith("left") ? -100 : s.position.endsWith("right") ? 100 : 0;
  const anchorY = s.position.startsWith("top") ? 100 : s.position.startsWith("bottom") ? -100 : 0;
  return { ...s, offsetX: clamp((s.offsetX - anchorX) / 2), offsetY: clamp(-(s.offsetY - anchorY) / 2) };
}

/** 文件名去掉扩展名，用作水印文字。 */
export function filenameAsText(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, "");
  return stem || name;
}

/** 手机抽屉收起时的一行摘要：“文字 · 示例水印 · 居中 · 70%”。 */
export function summarize(s: MarkSettings, markName: string | undefined, count: number): string {
  const parts: string[] = [];
  if (count > 1) parts.push(`${count} 张`);
  if (s.type === "text") {
    const first = s.text.split("\n")[0]?.trim() ?? "";
    parts.push("文字", first ? (first.length > 10 ? `${first.slice(0, 10)}…` : first) : "未填写");
  } else {
    parts.push("图片", markName ?? "未选择");
  }
  parts.push(s.position === "tile" ? `平铺 ${Math.round(s.rotation)}°` : CELL_NAMES[s.position]);
  parts.push(`${Math.round(s.opacity * 100)}%`);
  return parts.join(" · ");
}
