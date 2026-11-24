// 绘制方案：预览和每一种导出都只用这一个函数算水印画在哪，结果就不会不一致。
// 坐标都是原图的像素；预览和缩小的导出由绘制方整体缩放，不重新计算。
import { fontStack, SIZE_RANGE, type Cell, type MarkSettings, type SizeUnit } from "./settings";

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

/** 九宫格锚点离图片边缘的安全边距，按短边的比例：贴死边缘时字形的出头部分会被裁掉，看着也挤。 */
export const SAFE_MARGIN = 0.03;

/**
 * 单个水印：先按格子把外接框放到锚点（四边留安全边距），再按图片宽高的百分比偏移（向右、向下为正），
 * 最后夹紧，保证整个水印在图里。水印比图还大时放在正中。
 */
export function singleCenter(canvasW: number, canvasH: number, boxW: number, boxH: number, rotation: number, cell: Cell, offsetX: number, offsetY: number) {
  const b = rotatedBounds(boxW, boxH, rotation);
  const margin = SAFE_MARGIN * Math.min(canvasW, canvasH);
  const anchor = (side: "start" | "middle" | "end", total: number, half: number) =>
    side === "start" ? margin + half : side === "end" ? total - margin - half : total / 2;
  const h = cell.endsWith("left") ? "start" : cell.endsWith("right") ? "end" : "middle";
  const v = cell.startsWith("top") ? "start" : cell.startsWith("bottom") ? "end" : "middle";
  const x = anchor(h, canvasW, b.width / 2) + (offsetX / 100) * canvasW;
  const y = anchor(v, canvasH, b.height / 2) + (offsetY / 100) * canvasH;
  const clamp = (val: number, half: number, total: number) => (half * 2 >= total ? total / 2 : Math.min(total - half, Math.max(half, val)));
  return { x: clamp(x, b.width / 2, canvasW), y: clamp(y, b.height / 2, canvasH) };
}

/**
 * 平铺：每格是水印框加上间隔，位移按图片尺寸的百分比平移整张网格（向右、向下为正）。
 * 两个方向的间隔都按水印较长的一边算：文字水印又宽又扁，按各自的边算的话行距会挤成一条条斜线。
 * 位移先对格子取模，网格平移多远都铺满整张图；四边各多铺两格，转过的水印也盖得到角落。
 */
export function tileCenters(canvasW: number, canvasH: number, boxW: number, boxH: number, spacingX: number, spacingY: number, offsetX: number, offsetY: number) {
  const unit = Math.max(boxW, boxH) / 100;
  const cellW = Math.max(1, boxW + spacingX * unit);
  const cellH = Math.max(1, boxH + spacingY * unit);
  const mod = (v: number, m: number) => ((v % m) + m) % m;
  const startX = mod((offsetX / 100) * canvasW, cellW) - 2 * cellW;
  const startY = mod((offsetY / 100) * canvasH, cellH) - 2 * cellH;
  const centers: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = startY; y < canvasH + 2 * cellH; y += cellH, row++) {
    // 隔行错开半格（砖块式），斜着放时不会排成一条条竖线
    const shift = row % 2 ? cellW / 2 : 0;
    for (let x = startX + shift; x < canvasW + 2 * cellW; x += cellW) centers.push({ x, y });
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
      : [singleCenter(image.width, image.height, box.width, box.height, rotation, s.position, s.offsetX, s.offsetY)];
  return { opacity: s.opacity, rotation, box, content, centers };
}
