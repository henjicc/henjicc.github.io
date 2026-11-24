// 绘制方案：预览和每一种导出都只用这一个函数算水印画在哪，结果就不会不一致。
// 坐标都是原图的像素；预览和缩小的导出由绘制方整体缩放，不重新计算。
import { fontStack, SIZE_RANGE, type MarkSettings, type SizeUnit } from "./settings";

/** 量一行文字在给定 CSS 字体下的宽度。浏览器里用画布的 measureText，测试里传假的。 */
export type Measure = (text: string, font: string) => number;

export const LINE_HEIGHT = 1.2;
/** 文字太小就看不见了，百分比算出来再小也不低于它（原图像素）。 */
export const MIN_FONT_PX = 8;

export type MarkImageInfo = { width: number; height: number };

export type TextContent = {
  kind: "text";
  /** 不含字号的字体族，绘制时拼成 `${fontSize}px ${family}`。 */
  family: string;
  fontSize: number;
  color: string;
  /** 每行相对水印中心的位置（左对齐的起点、垂直居中的基线）。 */
  lines: { text: string; dx: number; dy: number }[];
};
export type ImageContent = { kind: "image"; markId: string; width: number; height: number };

export type DrawPlan = {
  opacity: number;
  /** 弧度，每个水印绕自己的中心转。 */
  rotation: number;
  /** 水印内容占的框（未旋转）。 */
  box: { width: number; height: number };
  content: TextContent | ImageContent;
  /** 每个水印中心的位置。 */
  centers: { x: number; y: number }[];
};

export function fontCss(fontSize: number, family: string): string {
  return `${fontSize}px ${family}`;
}

/** 百分比：第一行文字宽度占图宽的百分比；像素：直接是字号。 */
export function resolveFontSize(unit: SizeUnit, size: number, imageWidth: number, firstLineWidthAt10px: number): number {
  if (unit === "px") return Math.min(SIZE_RANGE.px.max, Math.max(MIN_FONT_PX, size));
  if (firstLineWidthAt10px <= 0) return MIN_FONT_PX;
  return Math.max(MIN_FONT_PX, ((10 * imageWidth) / firstLineWidthAt10px) * (size / 100));
}

/** 图片水印保持宽高比；百分比是宽度占图宽的百分比，像素是宽度。 */
export function resolveImageMarkSize(unit: SizeUnit, size: number, imageWidth: number, mark: MarkImageInfo): { width: number; height: number } {
  const width = unit === "percent" ? (imageWidth * size) / 100 : Math.max(10, Math.min(imageWidth, size));
  return { width, height: width * (mark.height / mark.width) };
}

export function layoutText(lines: string[], fontSize: number, widthOf: (line: string) => number) {
  const lineHeight = fontSize * LINE_HEIGHT;
  const widths = lines.map(widthOf);
  const width = Math.max(0, ...widths);
  const height = lines.length * lineHeight;
  return {
    width,
    height,
    lines: lines.map((text, i) => ({ text, dx: -widths[i]! / 2, dy: (i - (lines.length - 1) / 2) * lineHeight })),
  };
}

/** 转过之后的外接框。 */
export function rotatedBounds(width: number, height: number, rotation: number) {
  const sin = Math.abs(Math.sin(rotation));
  const cos = Math.abs(Math.cos(rotation));
  return { width: width * cos + height * sin, height: width * sin + height * cos };
}

/**
 * 单个水印：位移 ±100 对应水印外接框贴到图片边上（向上为正），再夹紧，保证整个水印在图里。
 * 水印比图还大时放在正中。
 */
export function singleCenter(canvasW: number, canvasH: number, boxW: number, boxH: number, rotation: number, offsetX: number, offsetY: number) {
  const b = rotatedBounds(boxW, boxH, rotation);
  const x = canvasW / 2 + (offsetX / 100) * ((canvasW - b.width) / 2);
  const y = canvasH / 2 - (offsetY / 100) * ((canvasH - b.height) / 2);
  const clamp = (v: number, half: number, total: number) => (half * 2 >= total ? total / 2 : Math.min(total - half, Math.max(half, v)));
  return { x: clamp(x, b.width / 2, canvasW), y: clamp(y, b.height / 2, canvasH) };
}

/**
 * 平铺：每格是水印框加上间隔，位移按图片尺寸的百分比平移整张网格。
 * 位移先对格子取模，网格平移多远都铺满整张图；四边各多铺两格，转过的水印也盖得到角落。
 */
export function tileCenters(canvasW: number, canvasH: number, boxW: number, boxH: number, spacingX: number, spacingY: number, offsetX: number, offsetY: number) {
  const cellW = Math.max(1, boxW * (1 + spacingX / 100));
  const cellH = Math.max(1, boxH * (1 + spacingY / 100));
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const startX = mod((offsetX / 100) * canvasW, cellW) - 2 * cellW;
  const startY = mod((-offsetY / 100) * canvasH, cellH) - 2 * cellH;
  const centers: { x: number; y: number }[] = [];
  for (let y = startY; y < canvasH + 2 * cellH; y += cellH) {
    for (let x = startX; x < canvasW + 2 * cellW; x += cellW) centers.push({ x, y });
  }
  return centers;
}

/**
 * 算出一张图上的全部水印。图片水印还没选图、文字为空时返回 null（什么都不画）。
 * markImage 是图片水印的原始宽高，没有时也返回 null。
 */
export function planWatermark(
  s: MarkSettings,
  image: { width: number; height: number },
  unit: SizeUnit,
  measure: Measure,
  markImage?: MarkImageInfo | null,
): DrawPlan | null {
  const rotation = (s.rotation * Math.PI) / 180;
  let content: DrawPlan["content"];
  let box: DrawPlan["box"];
  if (s.type === "image") {
    if (!s.markId || !markImage || markImage.width <= 0 || markImage.height <= 0) return null;
    box = resolveImageMarkSize(unit, s.size, image.width, markImage);
    content = { kind: "image", markId: s.markId, ...box };
  } else {
    if (!s.text.trim()) return null;
    const family = fontStack(s.font);
    const lines = s.text.split("\n");
    const fontSize = resolveFontSize(unit, s.size, image.width, measure(lines[0] || " ", fontCss(10, family)));
    const font = fontCss(fontSize, family);
    const layout = layoutText(lines, fontSize, (line) => measure(line, font));
    box = { width: layout.width, height: layout.height };
    content = { kind: "text", family, fontSize, color: s.color, lines: layout.lines };
  }
  const centers =
    s.position === "tile"
      ? tileCenters(image.width, image.height, box.width, box.height, s.spacingX, s.spacingY, s.offsetX, s.offsetY)
      : [singleCenter(image.width, image.height, box.width, box.height, rotation, s.offsetX, s.offsetY)];
  return { opacity: s.opacity, rotation, box, content, centers };
}
