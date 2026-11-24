// 图片的解码和缩放（浏览器侧）。HEIC 解码器按需加载，它自己在 Worker 里解码，不卡界面。
import { encodeWithinBudget, hasTransparency } from "./logic/mark-encode";
import { fitPixels, isHeic } from "./logic/output";
import { MARK_BUDGET, type Mark } from "./logic/presets";

/** 手机和 TOY：iOS WebKit 画布面积上限约 1677 万像素，超过时画出来是空白。 */
const MOBILE_MAX_PIXELS = 16_777_216;
/** 桌面浏览器的画布上限大得多（Chrome 约 2.68 亿像素），这里留出内存余量。 */
const DESKTOP_MAX_PIXELS = 100_000_000;
const MAX_SIDE = 16_384;
/** 预览用的位图最长边：够 2 倍屏看清，又不至于每张图占几十 MB 内存。 */
export const PREVIEW_MAX_SIDE = 2048;
const THUMB_SIDE = 160;
/** 水印图片存进本机存储，最长边限制在这里，几张就不会把存储撑满。 */
const MARK_MAX_SIDE = 1200;

export function exportLimits(coarsePointer: boolean): { maxPixels: number; maxSide: number } {
  return { maxPixels: coarsePointer ? MOBILE_MAX_PIXELS : DESKTOP_MAX_PIXELS, maxSide: MAX_SIDE };
}

export class DecodeError extends Error {}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new DecodeError("解码失败"));
    img.src = src;
  });
}

async function withObjectUrl<T>(blob: Blob, run: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(blob);
  try {
    return await run(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to");
  // 和旧版一致用 0.95：之后还要再编码一次导出，留足质量
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.95 });
}

async function looksLikeHeic(file: File): Promise<boolean> {
  try {
    const { isHeic: sniff } = await import("heic-to");
    return await sniff(file);
  } catch {
    return false;
  }
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new DecodeError("编码失败"))), type, quality));
}

/**
 * 读进一张用户选的图片：返回能解码的版本、摆正方向后的尺寸和缩略图。
 * 先按后缀和类型认 HEIC；浏览器解不了的再嗅探一次文件头（有的相册给的 HEIC 没有正确的类型）。
 */
export async function readImage(file: File): Promise<{ decodable: Blob; width: number; height: number; thumb: string }> {
  let decodable: Blob = file;
  if (isHeic(file.type, file.name)) {
    try {
      decodable = await heicToJpeg(file);
    } catch {
      // Safari 能直接解 HEIC，交给下面的通用路径再试一次
    }
  }
  let img: HTMLImageElement;
  try {
    img = await withObjectUrl(decodable, loadImage);
  } catch {
    if (decodable !== file || !(await looksLikeHeic(file))) throw new DecodeError("解码失败");
    decodable = await heicToJpeg(file);
    img = await withObjectUrl(decodable, loadImage);
  }
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  if (!width || !height) throw new DecodeError("解码失败");
  const t = fitPixels(width, height, Infinity, THUMB_SIDE);
  const c = canvas(t.width, t.height);
  c.getContext("2d")?.drawImage(img, 0, 0, t.width, t.height);
  const thumb = URL.createObjectURL(await toBlob(c, "image/jpeg", 0.8));
  return { decodable, width, height, thumb };
}

/**
 * 按目标尺寸解码。缩小时优先让浏览器在解码时缩放（大图在手机上整张解码可能直接失败），不支持再画到画布上缩。
 * width、height 是摆正方向后的尺寸（readImage 量出来的），所以解码时必须按 EXIF 方向转正：
 * 不转的话手机竖拍的照片会被横着拉伸。imageOrientation 的默认值在旧版浏览器里是 "none"，要显式写。
 * 退回路径用的 <img> 在各浏览器里画到画布时默认按 EXIF 摆正。返回值用完要调用 release。
 */
export async function decodeAt(blob: Blob, width: number, height: number): Promise<{ source: CanvasImageSource; release: () => void }> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image", resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
    if (bitmap.width === width && bitmap.height === height) return { source: bitmap, release: () => bitmap.close() };
    const c = canvas(width, height);
    c.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return { source: c, release: () => void (c.width = 0) };
  } catch {
    const img = await withObjectUrl(blob, loadImage);
    const c = canvas(width, height);
    c.getContext("2d")?.drawImage(img, 0, 0, width, height);
    return { source: c, release: () => void (c.width = 0) };
  }
}

/**
 * 把已经解码的水印图片画到不超过 1200 的尺寸，再按 encodeWithinBudget 的策略编码：
 * 每张约 300KB 以内，几张预设才不会把本机存储撑满。
 */
async function encodeMark(img: HTMLImageElement, opaqueHint: boolean): Promise<{ dataUrl: string; width: number; height: number }> {
  const size = fitPixels(img.naturalWidth || 512, img.naturalHeight || 512, Infinity, MARK_MAX_SIDE);
  const c = canvas(size.width, size.height);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new DecodeError("画不出来");
  ctx.drawImage(img, 0, 0, size.width, size.height);
  const opaque = opaqueHint || !hasTransparency(ctx.getImageData(0, 0, size.width, size.height).data);
  let out = { width: size.width, height: size.height };
  const r = await encodeWithinBudget((mime, quality, scale) => {
    const w = Math.max(1, Math.round(size.width * scale));
    const h = Math.max(1, Math.round(size.height * scale));
    out = { width: w, height: h };
    if (scale === 1) return c.toDataURL(mime, quality);
    const small = canvas(w, h);
    const sctx = small.getContext("2d");
    if (sctx) {
      sctx.imageSmoothingQuality = "high";
      sctx.drawImage(c, 0, 0, w, h);
    }
    const url = small.toDataURL(mime, quality);
    small.width = 0;
    return url;
  }, opaque);
  c.width = 0;
  return { dataUrl: r.dataUrl, ...out };
}

/** 选好的水印图片编码成 data URL。SVG 没有固有尺寸时按 512 画。 */
export async function readMarkImage(file: File, id: string): Promise<Mark> {
  const img = await withObjectUrl(file, loadImage);
  const encoded = await encodeMark(img, /^image\/jpe?g$/i.test(file.type));
  return { id, name: file.name, ...encoded };
}

/** 导入的预设里的水印图片可能很大（旧版工具存的是原图 PNG）：超过预算或 1200 的才重新编码，已经够小的原样保留。 */
export async function compactMark(mark: Mark): Promise<Mark> {
  if (mark.dataUrl.length <= MARK_BUDGET && Math.max(mark.width, mark.height) <= MARK_MAX_SIDE) return mark;
  const img = await loadImage(mark.dataUrl);
  return { ...mark, ...(await encodeMark(img, /^data:image\/jpe?g/i.test(mark.dataUrl))) };
}

const markCache = new Map<string, Promise<HTMLImageElement>>();

/** 水印图片解码一次后复用，拖滑块时不会反复加载、闪烁。 */
export function loadMark(mark: Mark): Promise<HTMLImageElement> {
  let cached = markCache.get(mark.id);
  if (!cached) {
    cached = loadImage(mark.dataUrl);
    markCache.set(mark.id, cached);
    cached.catch(() => markCache.delete(mark.id));
  }
  return cached;
}

/**
 * 第一次打开时舞台上的示例图：画出来的雾林山景，不用真实照片。
 * 颜色是图片内容，不是界面颜色，所以不走主题令牌。
 */
export function drawSample(): HTMLCanvasElement {
  const c = canvas(1600, 1000);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const sky = ctx.createLinearGradient(0, 0, 0, 1000);
  sky.addColorStop(0, "#8fb0c2");
  sky.addColorStop(0.55, "#dfe8ec");
  sky.addColorStop(1, "#c9d6cf");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1600, 1000);
  ctx.fillStyle = "rgba(255,240,210,.85)";
  ctx.beginPath();
  ctx.arc(1180, 300, 90, 0, Math.PI * 2);
  ctx.fill();
  const ridges: [string, number, number[]][] = [
    ["#6f8f86", 560, [0, 0.35, 0.2, 0.15, 0.42, 0.4, 0.6, 0.1, 0.8, 0.3, 1, 0.2]],
    ["#3f5e52", 680, [0, 0.3, 0.15, 0.45, 0.35, 0.2, 0.55, 0.5, 0.75, 0.15, 1, 0.4]],
    ["#22372f", 820, [0, 0.2, 0.25, 0.35, 0.5, 0.1, 0.7, 0.3, 0.9, 0.12, 1, 0.25]],
  ];
  for (const [color, base, points] of ridges) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 1000);
    for (let i = 0; i < points.length; i += 2) ctx.lineTo(points[i]! * 1600, base - points[i + 1]! * 260);
    ctx.lineTo(1600, 1000);
    ctx.closePath();
    ctx.fill();
  }
  return c;
}
