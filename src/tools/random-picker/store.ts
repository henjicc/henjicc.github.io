import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toolStorage } from "~/shell/tool/persist";
import meta from "./meta";

// 示例名单：第一次打开就能直接点“开始抽取”看效果。名字是编的。
export const SAMPLE_NAMES = "林小雾\n周一\n陈天光\n许晨\n白鹿\n江北\n沈一舟\n夏至\n顾言\n宋知秋";

export const DEFAULT_SETTINGS = { noRepeat: true, intervalMs: 70, fontScale: 100 };
type Settings = typeof DEFAULT_SETTINGS;

/** 小设置：TOY 上存 B 站云存储。 */
export const useSettings = create<Settings>()(
  persist(() => ({ ...DEFAULT_SETTINGS }), {
    name: "settings",
    version: 1,
    storage: toolStorage<Settings>(meta.id, "settings"),
  }),
);

type Session = { namesText: string; picked: string[] };

/**
 * 名单和抽取记录：可能很长，存本机，每次修改立即写。
 * TOY 里侧滑返回会退出、回来可能整页重载，抽到一半的“不重复”记录不能丢。
 */
export const useSession = create<Session>()(
  persist(() => ({ namesText: SAMPLE_NAMES, picked: [] as string[] }), {
    name: "session",
    version: 1,
    storage: toolStorage<Session>(meta.id, "local"),
  }),
);

export const persistedStores = [useSettings, useSession] as const;
