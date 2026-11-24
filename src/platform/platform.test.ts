// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToySdk } from "./types/toy";

function fakeSdk(cloud: Record<string, string> = {}) {
  const setCloudStorage = vi.fn(async (values: Record<string, string>) => {
    Object.assign(cloud, values);
  });
  const sdk = {
    isSupport: vi.fn(async () => true),
    getCloudStorage: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, cloud[k]]))),
    setCloudStorage,
  } as unknown as ToySdk;
  return { sdk, cloud, setCloudStorage };
}

async function loadToy() {
  vi.resetModules();
  return (await import("./toy")).createToyPlatform();
}

beforeEach(() => {
  localStorage.clear();
  delete window.toy;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("网站：剪贴板接口被拒时退回 execCommand", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    document.execCommand = vi.fn(() => true);
    const { createWebPlatform } = await import("./web");
    await expect(createWebPlatform().copyText("你好")).resolves.toBe("copied");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("TOY：不碰剪贴板接口，execCommand 也不行时选中给的元素让用户长按复制", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    document.execCommand = vi.fn(() => false);
    const toy = await loadToy();
    const source = document.createElement("p");
    source.textContent = "你好";
    document.body.append(source);
    await expect(toy.copyText("你好", source)).resolves.toBe("selected");
    expect(window.getSelection()?.toString()).toBe("你好");
    await expect(toy.copyText("你好")).resolves.toBe("failed");
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("TOY 设置存储", () => {
  it("先写本机镜像；停止修改后合并成一次云端写入", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage } = fakeSdk();
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("random-picker");
    await store.set("settings", { a: 1 });
    await store.set("settings", { a: 2 });
    await store.set("other", true);
    expect(setCloudStorage).not.toHaveBeenCalled();
    // 重载后马上能从镜像读到最新值，不用等云端
    expect(JSON.parse(localStorage.getItem("henji:random-picker:settings@cloud") ?? "{}").v).toEqual({ a: 2 });
    await vi.advanceTimersByTimeAsync(1300);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    const batch = setCloudStorage.mock.calls[0]?.[0] ?? {};
    expect(Object.keys(batch).sort()).toEqual(["random_picker_other", "random_picker_settings"]);
    expect(JSON.parse(batch.random_picker_settings ?? "{}").v).toEqual({ a: 2 });
  });

  it("页面隐藏时立即写出还没发送的修改", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage } = fakeSdk();
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("k", 1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  it("超过 1KB 的值只留在本机，不发给云存储", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sdk, setCloudStorage } = fakeSdk();
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("big", "名".repeat(400));
    await vi.advanceTimersByTimeAsync(2000);
    expect(setCloudStorage).not.toHaveBeenCalled();
    await expect(store.get("big")).resolves.toBe("名".repeat(400));
  });

  it("云端和本机镜像都有时取更新的那份", async () => {
    const { sdk } = fakeSdk({ t_k: JSON.stringify({ t: 200, v: "云端" }) });
    window.toy = sdk;
    localStorage.setItem("henji:t:k@cloud", JSON.stringify({ t: 100, v: "本机" }));
    const store = (await loadToy()).storage.settings("t");
    await expect(store.get("k")).resolves.toBe("云端");
    localStorage.setItem("henji:t:k@cloud", JSON.stringify({ t: 300, v: "本机新" }));
    await expect(store.get("k")).resolves.toBe("本机新");
  });

  it("App 外没有 SDK 时退回本机存储", async () => {
    const store = (await loadToy()).storage.settings("t");
    await store.set("k", { x: 1 });
    await expect(store.get("k")).resolves.toEqual({ x: 1 });
  });
});
