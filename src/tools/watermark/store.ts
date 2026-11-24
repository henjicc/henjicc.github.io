import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toolStorage } from "~/shell/tool/persist";
import type { Mark, Preset } from "./logic/presets";
import type { Selection } from "./logic/selection";
import { FACTORY_APP, FACTORY_MARK, parseAppSettings, parseMarkSettings, type AppSettings, type MarkSettings } from "./logic/settings";
import meta from "./meta";

/** 应用设置（默认水印、单位、导出格式）：几百字节，TOY 上存 B 站云存储。 */
export const useApp = create<AppSettings>()(
  persist(() => ({ ...FACTORY_APP }), {
    name: "settings",
    version: 1,
    storage: toolStorage<AppSettings>(meta.id, "settings"),
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
    version: 1,
    storage: toolStorage<Draft>(meta.id, "local"),
    merge: (persisted, current) => ({ ...current, current: parseMarkSettings((persisted as Partial<Draft> | undefined)?.current) }),
  }),
);

type Library = { marks: Record<string, Mark>; presets: Preset[] };

/** 水印图片和预设：可能有几 MB（图片是 data URL），只存本机，不进云存储。和草稿分开存，拖滑块时不用反复写大数据。 */
export const useLibrary = create<Library>()(
  persist(() => ({ marks: {} as Record<string, Mark>, presets: [] as Preset[] }), {
    name: "library",
    version: 1,
    storage: toolStorage<Library>(meta.id, "local"),
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
