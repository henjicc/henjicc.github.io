// 导出：每张图都用同一个绘制方案在原尺寸（或画布上限以内）重画一遍。
// 网站：单张按设置的格式和质量编码（JPEG 带上原图的 EXIF）后下载，多张边编码边流式打成 ZIP；
// TOY：逐张各自存进相册（平台层统一转成 JPEG），一张失败不影响其他张，存完由调用方按结果弹一次轻提示。
import { platform } from "~/platform";
import { insertExif, heifExif, jpegExif, patchExif } from "./logic/exif";
import { chooseOutputFormat, fitPixels, isHeic, outputFileName, zipFileName } from "./logic/output";
import type { Mark } from "./logic/presets";
import type { AppSettings } from "./logic/settings";
import { decodeAt, exportLimits, loadMark } from "./image";
import { drawWatermarked, planFor } from "./render";
import type { ImageItem } from "./store";

type RenderResult = { canvas: HTMLCanvasElement; width: number; height: number; scaled: boolean };

function coarsePointer(): boolean {
  return platform.kind === "toy" || window.matchMedia("(pointer: coarse)").matches;
}

async function renderFull(item: ImageItem, app: AppSettings, marks: Readonly<Record<string, Mark>>, opaque: boolean): Promise<RenderResult> {
  const limits = exportLimits(coarsePointer());
  const size = fitPixels(item.width, item.height, limits.maxPixels, limits.maxSide);
  const mark = item.settings.markId ? marks[item.settings.markId] : undefined;
  const plan = planFor(item.settings, item, app.unit, item.settings.type === "image" ? mark : undefined);
  const markImage = plan?.content.kind === "image" && mark ? await loadMark(mark) : null;
  const decoded = await decodeAt(item.decodable, size.width, size.height);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("图片太大，浏览器画不出来，换小一点的图再试");
    drawWatermarked(ctx, decoded.source, plan, size.width / item.width, markImage, opaque ? "#ffffff" : undefined);
    return { canvas, width: size.width, height: size.height, scaled: size.scale < 1 };
  } finally {
    decoded.release();
  }
}

async function readExif(item: ImageItem): Promise<Uint8Array | null> {
  try {
    const bytes = new Uint8Array(await item.original.arrayBuffer());
    return isHeic(item.mime, item.name) ? heifExif(bytes) : jpegExif(bytes);
  } catch {
    return null;
  }
}

async function encode(item: ImageItem, app: AppSettings, marks: Readonly<Record<string, Mark>>) {
  const format = chooseOutputFormat(app.format, item.mime, item.name, app.quality);
  const r = await renderFull(item, app, marks, format.mime === "image/jpeg");
  let blob = await new Promise<Blob | null>((resolve) => r.canvas.toBlob(resolve, format.mime, format.quality));
  r.canvas.width = 0;
  if (!blob) throw new Error("图片太大，浏览器生成不了，换小一点的图再试");
  // 浏览器不支持 WebP 编码时（旧版 Safari）会悄悄给出 PNG，按实际类型取扩展名
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  if (blob.type === "image/jpeg") {
    const exif = await readExif(item);
    const patched = exif && patchExif(exif, r);
    if (patched) blob = new Blob([insertExif(new Uint8Array(await blob.arrayBuffer()), patched) as Uint8Array<ArrayBuffer>], { type: "image/jpeg" });
  }
  return { blob, filename: outputFileName(item.name, ext), scaled: r.scaled };
}

export type ExportOutcome =
  | { kind: "downloaded"; count: number; scaled: number }
  /**
   * TOY：saved 是存进相册的图，failed 是没存上的（包括出错后没再处理的）。
   * shown 为 true 时平台层存不了相册，已经把 failed 的第一张显示出来让用户长按保存，后面的没再处理。
   */
  | { kind: "album"; saved: string[]; failed: string[]; shown: boolean; error?: unknown; scaled: number };

/** 图片类型选了“图片”却没有可用的水印图片：这些图导出去不会带水印。 */
export function missingMark(items: readonly ImageItem[], marks: Readonly<Record<string, Mark>>): ImageItem[] {
  return items.filter((im) => im.settings.type === "image" && !(im.settings.markId && marks[im.settings.markId]));
}

async function saveToAlbum(items: readonly ImageItem[], app: AppSettings, marks: Readonly<Record<string, Mark>>, onProgress: (done: number) => void): Promise<ExportOutcome> {
  const saved: string[] = [];
  const failed: string[] = [];
  let scaled = 0;
  let error: unknown;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    try {
      const r = await renderFull(item, app, marks, true);
      if (r.scaled) scaled++;
      try {
        const result = await platform.saveImage(r.canvas, outputFileName(item.name, "jpg"));
        if (result === "shown") {
          // 平台层已经弹出这张让用户长按保存；再往下存会一张张叠上去，停在这里，剩下的交给“重试”
          failed.push(...items.slice(i).map((im) => im.id));
          return { kind: "album", saved, failed, shown: true, scaled };
        }
        saved.push(item.id);
      } finally {
        r.canvas.width = 0;
      }
    } catch (e) {
      error ??= e;
      failed.push(item.id);
    }
    onProgress(i + 1);
  }
  return { kind: "album", saved, failed, shown: false, error, scaled };
}

export async function exportImages(
  items: readonly ImageItem[],
  app: AppSettings,
  marks: Readonly<Record<string, Mark>>,
  onProgress: (done: number) => void,
): Promise<ExportOutcome> {
  if (platform.kind === "toy") return saveToAlbum(items, app, marks, onProgress);

  if (items.length === 1) {
    const one = await encode(items[0]!, app, marks);
    onProgress(1);
    await platform.saveImage(one.blob, one.filename);
    return { kind: "downloaded", count: 1, scaled: one.scaled ? 1 : 0 };
  }

  const { createZipStream } = await import("./zip");
  const zip = createZipStream();
  let scaled = 0;
  for (let i = 0; i < items.length; i++) {
    const one = await encode(items[i]!, app, marks);
    if (one.scaled) scaled++;
    await zip.add(one.filename, one.blob);
    onProgress(i + 1);
  }
  await platform.saveFile(await zip.finish(), zipFileName(new Date()));
  return { kind: "downloaded", count: items.length, scaled };
}
