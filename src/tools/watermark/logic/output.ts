// 导出格式、文件名和画布尺寸上限。
import type { ExportFormat } from "./settings";

export type OutputFormat = { mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp"; quality?: number };

export function isHeic(mime: string, name: string): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(mime) || /\.hei[cf]$/i.test(name);
}

/**
 * “自动”：可能带透明的格式（PNG、WebP、GIF）出 PNG，其余（JPEG、HEIC 等照片）出 JPEG。
 * PNG 没有质量参数。
 */
export function chooseOutputFormat(setting: ExportFormat, sourceMime: string, sourceName: string, quality: number): OutputFormat {
  let pick: "jpeg" | "png" | "webp" = setting === "auto" ? "jpeg" : setting;
  if (setting === "auto" && !isHeic(sourceMime, sourceName) && /^image\/(png|webp|gif|apng)$/i.test(sourceMime)) pick = "png";
  if (pick === "png") return { mime: "image/png", ext: "png" };
  if (pick === "webp") return { mime: "image/webp", ext: "webp", quality };
  return { mime: "image/jpeg", ext: "jpg", quality };
}

export function outputFileName(sourceName: string, ext: string): string {
  const stem = sourceName.replace(/\.[^./\\]+$/, "") || "image";
  return `watermarked-${stem}.${ext}`;
}

/** 压缩包里重名的文件依次加上 (2)、(3)，否则后一个会盖掉前一个。 */
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

export function zipFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `watermarked-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`;
}

/**
 * 把尺寸缩到像素总数和单边长度的上限以内，保持宽高比；本来就在范围内时原样返回。
 * iOS WebKit 的画布面积上限约 1677 万像素，超过时画出来是空白。
 */
export function fitPixels(width: number, height: number, maxPixels: number, maxSide: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, Math.sqrt(maxPixels / Math.max(1, width * height)), maxSide / Math.max(width, height));
  if (scale >= 1) return { width, height, scale: 1 };
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale };
}
