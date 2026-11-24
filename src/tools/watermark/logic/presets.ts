// 预设和水印图片的数据结构，以及预设的导入导出（文件或“预设代码”是同一段 JSON）。
import { z } from "zod";
import { estimateV1Box, FACTORY_MARK, migrateOffsetsV1,parseMarkSettings, type MarkSettings } from "./settings";

/**
 * 每张水印图片 data URL 的目标长度（字符）。图片和预设整个存在一个 localStorage 键里，
 * 浏览器给一个域名的本机存储一般只有约 500 万字符，全站的工具共用。
 */
export const MARK_BUDGET = 300_000;
/** 整个预设库序列化后的上限（字符），给同站其他工具的存储留出余量。 */
export const LIBRARY_BUDGET = 3_000_000;

/** 图片水印：存成 data URL（不透明的是 JPEG，带透明的是 WebP，浏览器不支持 WebP 编码时是 PNG）。 */
export type Mark = { id: string; name: string; dataUrl: string; width: number; height: number };
export type Preset = { id: string; name: string; createdAt: string; settings: MarkSettings };

const markSchema = z.object({
  name: z.string().max(200).catch("水印图片"),
  dataUrl: z.string().startsWith("data:image/"),
  width: z.number().positive(),
  height: z.number().positive(),
});

const presetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  createdAt: z.string().catch(() => new Date(0).toISOString()),
  settings: z.unknown(),
  mark: markSchema.optional().catch(undefined),
});

/** 第 2 版改了位移的含义，读第 1 版文件时换算。 */
const FILE_VERSION = 2;
const fileSchema = z.object({ app: z.literal("henji-watermark"), version: z.union([z.literal(1), z.literal(2)]), presets: z.array(z.unknown()) });

/** 旧版水印工具（wmt 子域名）导出的预设：设置里直接带着图片的 data URL。 */
const legacyPresetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  createdAt: z.string().catch(() => new Date(0).toISOString()),
  settings: z.looseObject({
    position: z.string().optional(),
    fontFamily: z.string().optional(),
    imageData: z.string().optional(),
    imageName: z.string().optional(),
    imageWidth: z.number().optional(),
    imageHeight: z.number().optional(),
  }),
});

function legacyFont(family: string | undefined): string {
  if (!family) return FACTORY_MARK.font;
  if (/courier|mono/i.test(family)) return "mono";
  if (/times|georgia|simsun|song|serif/i.test(family)) return "song";
  return "hei";
}

export function createPreset(name: string, settings: MarkSettings, id: string, now: Date): Preset {
  return { id, name: name.trim().slice(0, 60), createdAt: now.toISOString(), settings };
}

/** 导出：预设用到的水印图片一起带上，换台设备导入也完整。 */
export function exportPresets(presets: readonly Preset[], marks: Readonly<Record<string, Mark>>): string {
  return JSON.stringify({
    app: "henji-watermark",
    version: FILE_VERSION,
    presets: presets.map((p) => {
      const mark = p.settings.markId ? marks[p.settings.markId] : undefined;
      return {
        name: p.name,
        createdAt: p.createdAt,
        settings: { ...p.settings, markId: null },
        ...(mark ? { mark: { name: mark.name, dataUrl: mark.dataUrl, width: mark.width, height: mark.height } } : {}),
      };
    }),
  });
}

export class PresetImportError extends Error {}

/**
 * 导入：认本工具导出的格式和旧版水印工具导出的数组。每个预设和水印图片都换新 id，追加而不覆盖。
 * 看不懂的条目跳过；一个都读不出来时抛 PresetImportError。
 */
export function importPresets(text: string, newId: () => string): { presets: Preset[]; marks: Mark[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PresetImportError("不是预设文件");
  }
  const presets: Preset[] = [];
  const marks: Mark[] = [];
  const addMark = (m: Omit<Mark, "id">) => {
    const mark = { ...m, id: newId() };
    marks.push(mark);
    return mark.id;
  };

  const file = fileSchema.safeParse(data);
  if (file.success) {
    for (const raw of file.data.presets) {
      const p = presetSchema.safeParse(raw);
      if (!p.success) continue;
      const parsed = parseMarkSettings(p.data.settings);
      const mark = p.data.mark;
      const settings = file.data.version < 2 ? migrateOffsetsV1(parsed, estimateV1Box(parsed, { markAspect: mark && mark.height / mark.width })) : parsed;
      settings.markId = p.data.mark ? addMark(p.data.mark) : null;
      presets.push({ id: newId(), name: p.data.name, createdAt: p.data.createdAt, settings });
    }
  } else if (Array.isArray(data)) {
    for (const raw of data) {
      const p = legacyPresetSchema.safeParse(raw);
      if (!p.success) continue;
      const old = p.data.settings;
      // 旧版工具的位移和本工具第 1 版是同一套含义
      const parsed = parseMarkSettings({
        ...old,
        // 旧版的间隔是原图像素，换算不了，留空让它取默认值
        spacingX: undefined,
        spacingY: undefined,
        position: old.position === "full-screen" ? "tile" : old.position,
        font: legacyFont(old.fontFamily),
        markId: null,
      });
      const markAspect = old.imageWidth && old.imageHeight ? old.imageHeight / old.imageWidth : undefined;
      const settings = migrateOffsetsV1(parsed, estimateV1Box(parsed, { markAspect }));
      const mark = markSchema.safeParse({ name: old.imageName, dataUrl: old.imageData, width: old.imageWidth, height: old.imageHeight });
      if (mark.success) settings.markId = addMark(mark.data);
      else if (settings.type === "image") settings.type = "text";
      presets.push({ id: newId(), name: p.data.name, createdAt: p.data.createdAt, settings });
    }
  }
  if (!presets.length) throw new PresetImportError(file.success || Array.isArray(data) ? "文件里没有能用的预设" : "不是预设文件");
  return { presets, marks };
}

/** 水印图片只在被用到时保留：当前设置、默认设置、图片各自的设置、预设。删掉其余的，免得本机存储越积越多。 */
export function pruneMarks(marks: Readonly<Record<string, Mark>>, inUse: Iterable<string | null>): Record<string, Mark> {
  const keep = new Set(inUse);
  return Object.fromEntries(Object.entries(marks).filter(([id]) => keep.has(id)));
}

/** 预设库序列化后的长度（字符），和存储里实际写进去的大小一致。 */
export function librarySize(library: { marks: Readonly<Record<string, Mark>>; presets: readonly Preset[] }): number {
  return JSON.stringify({ state: library, version: FILE_VERSION }).length;
}

export class LibraryFullError extends Error {}
