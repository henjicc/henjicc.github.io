import { useCallback, useSyncExternalStore } from "react";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { platform } from "~/platform";

/**
 * 给 zustand 的 persist 中间件用的存储，按工具 id 分命名空间，全部经平台适配层：
 * - "settings"：小设置（整个序列化结果 ≤1KB）。TOY 存 B 站云存储（合并写入、页面隐藏时立即写），网站存 localStorage。
 * - "local"：名单、文本这类较大的输入和进度。两边都存 localStorage，每次修改立即写，侧滑退出或重载都不丢。
 *
 * 用法：create(persist(fn, { name: "settings", version: 1, storage: toolStorage("random-picker", "settings") }))
 */
export function toolStorage<S>(toolId: string, kind: "settings" | "local"): PersistStorage<S> {
  const store = kind === "settings" ? platform.storage.settings(toolId) : platform.storage.local(toolId);
  return {
    getItem: async (name) => (await store.get<StorageValue<S>>(name)) ?? null,
    setItem: (name, value) => store.set(name, value),
    removeItem: (name) => store.remove(name),
  };
}

type PersistedStore = {
  persist: { hasHydrated(): boolean; onFinishHydration(listener: () => void): () => void };
};

/** 这些 store 都从存储里读完之后为 true。在那之前别把默认值当成用户的数据显示出来。stores 要传模块级的常量数组。 */
export function useStoresHydrated(stores: readonly PersistedStore[]): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const offs = stores.map((s) => s.persist.onFinishHydration(onChange));
      return () => offs.forEach((off) => off());
    },
    [stores],
  );
  return useSyncExternalStore(
    subscribe,
    () => stores.every((s) => s.persist.hasHydrated()),
    () => false,
  );
}
