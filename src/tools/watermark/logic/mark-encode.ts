// 水印图片存进本机存储前的编码策略。真正的编码由调用方用画布做，这里只决定试哪些格式、质量和尺寸。
import { MARK_BUDGET } from "./presets";

/** 按给定格式、质量和缩放比例编码，返回 data URL。浏览器不支持的格式会悄悄给出 PNG（data:image/png）。 */
export type EncodeMark = (mime: "image/jpeg" | "image/webp", quality: number, scale: number) => string | Promise<string>;

const QUALITIES = [0.9, 0.8, 0.7, 0.6];
/** 每轮缩到 80%：8 轮后约是原来的 17%，1200px 的图只剩约 200px，任何内容都能压进预算。 */
const SCALES = [1, 0.8, 0.64, 0.51, 0.41, 0.33, 0.26, 0.21, 0.17];

/**
 * 不透明的图用 JPEG，带透明的用 WebP（保留透明）。先降质量，再缩尺寸，直到 data URL 不超过 budget。
 * 实在压不进去时返回最小的那一版，由调用方的整库预算兜底。
 */
export async function encodeWithinBudget(encode: EncodeMark, opaque: boolean, budget = MARK_BUDGET): Promise<{ dataUrl: string; scale: number }> {
  const mime = opaque ? "image/jpeg" : "image/webp";
  let last = { dataUrl: "", scale: 1 };
  for (const scale of SCALES) {
    for (const quality of QUALITIES) {
      const dataUrl = await encode(mime, quality, scale);
      last = { dataUrl, scale };
      if (dataUrl.length <= budget) return last;
      // 退回成 PNG 时质量参数不起作用，直接缩尺寸
      if (!dataUrl.startsWith(`data:${mime}`)) break;
    }
  }
  return last;
}

/** 带 alpha 的像素数据里有没有不是完全不透明的点。 */
export function hasTransparency(rgba: Uint8ClampedArray): boolean {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i]! < 255) return true;
  return false;
}
