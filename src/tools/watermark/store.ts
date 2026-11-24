import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { toolStorage } from "~/shell/tool/persist";
import type { Mark, Preset } from "./logic/presets";
import type { Selection } from "./logic/selection";
import {
  estimateV1Box,
  FACTORY_APP,
  FACTORY_MARK,
  migrateOffsetsV1,
  parseAppSettings,
  parseMarkSettings,
  type AppSettings,
  type MarkSettings,
  type SizeUnit,
} from "./logic/settings";

/** 第 2 版改了位移的含义（见 migrateOffsetsV1），三个存储都要换算存过的水印设置。 */
const VERSION = 2;

/** 换算要估水印在图上占多大：知道单位和水印图片的宽高时传进来，不知道时按百分比单位、方形图片估。 */
function migrateMark(value: unknown, version: number, hints: { unit?: SizeUnit; mark?: { width: number; height: number } } = {}): MarkSettings {
  const s = parseMarkSettings(value);
  if (version >= 2) return s;
  const markAspect = hints.mark && hints.mark.width > 0 ? hints.mark.height / hints.mark.width : undefined;
  return migrateOffsetsV1(s, estimateV1Box(s, { unit: hints.unit, markAspect }));
}
import meta from "./meta";

/** 应用设置（默认水印、单位、导出格式）：几百字节，TOY 上存 B 站云存储。 */
export const useApp = create<AppSettings>()(
  persist(() => ({ ...FACTORY_APP }), {
    name: "settings",
    version: VERSION,
    storage: toolStorage<AppSettings>(meta.id, "settings"),
    migrate: (persisted, version) => {
      const p = (persisted ?? {}) as Partial<AppSettings>;
      return { ...p, defaults: migrateMark(p.defaults, version, { unit: p.unit === "px" ? "px" : "percent" }) } as AppSettings;
    },
    merge: (persisted, current) => ({ ...current, ...parseAppSettings(persisted) }),
  }),
);

type Draft = { current: MarkSettings };

/**
 * 面板上正在改的水印设置：每次修改立即存本机。
 * TOY 里侧滑返回会退出、回来可能整页重载，调到一半的设置不能丢；图片本身不存，回来要重新选图。
 */
export const useDraft = create<Draft>()(
  persist(() => ({ current: { ...FACTORY_MARK } }), {
    name: "draft",
    version: VERSION,
    storage: toolStorage<Draft>(meta.id, "local"),
    migrate: (persisted, version) => ({ current: migrateMark((persisted as Partial<Draft> | undefined)?.current, version) }),
    merge: (persisted, current) => ({ ...current, current: parseMarkSettings((persisted as Partial<Draft> | undefined)?.current) }),
  }),
);

type Library = { marks: Record<string, Mark>; presets: Preset[] };

let lastLibraryWrite: Promise<boolean> = Promise.resolve(true);

/**
 * 平台层写本机存储失败（存满了）时不报错，只是没存上，重载后预设就没了。
 * 这里写完再读回来比一遍，写没写上由 libraryWritten() 告诉调用方。库只在增删预设和水印图片时才写，读回的开销可以接受。
 */
function verifiedStorage(base: PersistStorage<Library>): PersistStorage<Library> {
  return {
    ...base,
    setItem: (name, value) => {
      const write = (async () => {
        await base.setItem(name, value);
        const back = await base.getItem(name);
        return JSON.stringify(back) === JSON.stringify(value);
      })();
      lastLibraryWrite = write.catch(() => false);
      return lastLibraryWrite.then(() => undefined);
    },
  };
}

/** 最近一次写预设库的结果：true 表示读回来和写进去的一样。 */
export function libraryWritten(): Promise<boolean> {
  return lastLibraryWrite;
}

/** 水印图片和预设：可能有几 MB（图片是 data URL），只存本机，不进云存储。和草稿分开存，拖滑块时不用反复写大数据。 */
export const useLibrary = create<Library>()(
  persist(() => ({ marks: {} as Record<string, Mark>, presets: [] as Preset[] }), {
    name: "library",
    version: VERSION,
    storage: verifiedStorage(toolStorage<Library>(meta.id, "local")),
    migrate: (persisted, version) => {
      const p = (persisted ?? {}) as Partial<Library>;
      if (!Array.isArray(p.presets)) return p as Library;
      const marks = (p.marks && typeof p.marks === "object" ? p.marks : {}) as Record<string, Mark | undefined>;
      const markOf = (settings: unknown) => {
        const id = (settings as { markId?: unknown } | null | undefined)?.markId;
        return typeof id === "string" ? marks[id] : undefined;
      };
      return {
        ...p,
        presets: p.presets.map((x) => (x && typeof x === "object" ? { ...x, settings: migrateMark(x.settings, version, { mark: markOf(x.settings) }) } : x)),
      } as Library;
    },
    merge: (persisted, current) => {
      const p = persisted as Partial<Library> | undefined;
      const presets = Array.isArray(p?.presets)
        ? p.presets
            .filter((x): x is Preset => Boolean(x && typeof x.id === "string" && typeof x.name === "string"))
            .map((x) => ({ ...x, settings: parseMarkSettings(x.settings) }))
        : [];
      return { ...current, marks: p?.marks && typeof p.marks === "object" ? p.marks : {}, presets };
    },
  }),
);

export const persistedStores = [useApp, useDraft, useLibrary] as const;

export type ImageItem = {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** 用户选的原文件，导出时从里面读 EXIF。 */
  original: Blob;
  /** 浏览器能解码的版本：一般就是原文件，HEIC 是转好的 JPEG。 */
  decodable: Blob;
  /** 摆正方向后的原图尺寸。 */
  width: number;
  height: number;
  /** 缩略图的 object URL。 */
  thumb: string;
  settings: MarkSettings;
};

type Session = Selection & {
  images: ImageItem[];
  currentId: string | null;
  /** 手机上长按缩略图进入多选，之后单击是加减选择。 */
  selectMode: boolean;
};

/** 打开的图片只在内存里。 */
export const useSession = create<Session>()(() => ({ images: [], currentId: null, selected: [], anchor: null, selectMode: false }));
