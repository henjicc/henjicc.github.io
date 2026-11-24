// 导出：每张图都用同一个绘制方案在原尺寸（或画布上限以内）重画一遍。
// 网站：单张按设置的格式和质量编码（JPEG 带上原图的 EXIF）后下载，多张打成 ZIP；
// TOY：逐张存进相册（平台层统一转成 JPEG），存完由调用方弹一次轻提示。
import { platform } from "~/platform";
import { insertExif, heifExif, jpegExif, patchExif } from "./logic/exif";
import { chooseOutputFormat, fitPixels, isHeic, outputFileName, uniqueNames, zipFileName } from "./logic/output";
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
  | { kind: "saved"; count: number; scaled: number }
  /** TOY 外没有 SDK：平台层显示了第 shownAt 张让用户长按保存，后面的没再处理。 */
  | { kind: "shown"; count: number; scaled: number };

export async function exportImages(
  items: readonly ImageItem[],
  app: AppSettings,
  marks: Readonly<Record<string, Mark>>,
  onProgress: (done: number) => void,
): Promise<ExportOutcome> {
  let scaled = 0;
  if (platform.kind === "toy") {
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const r = await renderFull(item, app, marks, true);
      if (r.scaled) scaled++;
      const result = await platform.saveImage(r.canvas, outputFileName(item.name, "jpg"));
      r.canvas.width = 0;
      onProgress(i + 1);
      if (result === "shown") return { kind: "shown", count: i + 1, scaled };
    }
    return { kind: "saved", count: items.length, scaled };
  }

  if (items.length === 1) {
    const one = await encode(items[0]!, app, marks);
    onProgress(1);
    await platform.saveImage(one.blob, one.filename);
    return { kind: "downloaded", count: 1, scaled: one.scaled ? 1 : 0 };
  }

  const files: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < items.length; i++) {
    const one = await encode(items[i]!, app, marks);
    if (one.scaled) scaled++;
    files.push({ name: one.filename, data: new Uint8Array(await one.blob.arrayBuffer()) });
    onProgress(i + 1);
  }
  const { zipSync } = await import("fflate");
  const names = uniqueNames(files.map((f) => f.name));
  // 图片本身已经压缩过，再压一遍几乎不变小，只存储不压缩
  const zipped = zipSync(Object.fromEntries(files.map((f, i) => [names[i]!, [f.data, { level: 0 }]])));
  await platform.saveFile(new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/zip" }), zipFileName(new Date()));
  return { kind: "downloaded", count: items.length, scaled };
}
