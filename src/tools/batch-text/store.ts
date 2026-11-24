import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { platform } from "~/platform";
import { toolStorage } from "~/shell/tool/persist";
import type { ApiConfig } from "./logic/api";
import type { ExportFormat } from "./logic/files";
import type { PromptTemplate } from "./logic/prompt";
import { stopProcessing, type QueueItem } from "./logic/queue";
import meta from "./meta";

// 模型名不预填：哪个模型能用取决于用户的接口，写死一个名字很快就会过时
export const DEFAULT_CONFIG: ApiConfig = { id: "default", name: "默认配置", baseUrl: "https://api.openai.com/v1", model: "" };
export const DEFAULT_TEMPLATE: PromptTemplate = {
  id: "default",
  name: "默认模板",
  systemPrompt: "你是一个专业的文本处理助手，请根据用户的要求处理文本内容。",
  userPrompt: "请处理以下文本内容：\n\n{content}",
};

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type Settings = { activeConfigId: string; activeTemplateId: string; exportFormat: ExportFormat };
export const DEFAULT_SETTINGS: Settings = { activeConfigId: DEFAULT_CONFIG.id, activeTemplateId: DEFAULT_TEMPLATE.id, exportFormat: "txt" };

export const useSettings = create<Settings>()(
  persist(() => ({ ...DEFAULT_SETTINGS }), {
    name: "settings",
    version: 1,
    storage: toolStorage<Settings>(meta.id, "settings"),
  }),
);

/** 接口配置（不含密钥）和提示词模板。提示词可能很长，存本机。 */
type Library = { configs: ApiConfig[]; templates: PromptTemplate[] };

export const useLibrary = create<Library>()(
  persist(() => ({ configs: [DEFAULT_CONFIG], templates: [DEFAULT_TEMPLATE] }), {
    name: "library",
    version: 1,
    storage: toolStorage<Library>(meta.id, "local"),
  }),
);

type Keys = {
  /** 按配置 id 存的接口密钥。 */
  keys: Record<string, string>;
  /** 用户打开“在此设备记住”才为 true；只有这时密钥才写进存储。 */
  remember: boolean;
};

/**
 * 密钥默认只在内存里，关掉页面就没了。remember 为 false 时每次变化都删掉存储里的那一份，
 * 所以关掉开关就等于把保存过的密钥删了；存储里有记录就说明上次是打开的。
 */
function keyStorage(): PersistStorage<Keys> {
  const base = toolStorage<Keys>(meta.id, "local");
  return {
    getItem: base.getItem,
    setItem: (name, value) => (value.state.remember ? base.setItem(name, value) : base.removeItem(name)),
    removeItem: base.removeItem,
  };
}

export const useKeys = create<Keys>()(
  persist((): Keys => ({ keys: {}, remember: false }), {
    name: "keys",
    version: 1,
    storage: keyStorage(),
  }),
);

/**
 * 多个标签页共用同一份存储。另一个标签页关掉“记住”或清除密钥时存储里那一份被删掉，这边要跟着关掉并丢掉内存里的密钥；
 * 否则这边下一次改动会把全部密钥原样写回去，等于撤销了那边的清除。存储里有记录时以存储为准。
 * 在 storage 事件里调用（只有别的标签页改动才会触发）。
 */
export async function syncKeysFromStorage(): Promise<void> {
  const stored = await platform.storage.local(meta.id).get<unknown>("keys");
  if (stored !== undefined) await useKeys.persist.rehydrate();
  else if (useKeys.getState().remember) useKeys.setState({ keys: {}, remember: false });
}

/** 这一次打开的文件和结果，只在内存里（旧版也不保存）。 */
type Session = { items: QueueItem[]; running: boolean; runIds: string[]; concurrency: number };

export const useSession = create<Session>()(() => ({ items: [], running: false, runIds: [], concurrency: 1 }));

/** 停止和离开页面共用：不再算运行中，正在处理的放回待处理。 */
export function resetRun() {
  useSession.setState((s) => ({ running: false, items: stopProcessing(s.items) }));
}

export function updateItem(id: string, patch: Partial<QueueItem>) {
  useSession.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
}

export const persistedStores = [useSettings, useLibrary, useKeys] as const;
