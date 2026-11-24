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

describe("保存图片和文件", () => {
  function captureDownloads() {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    return { createObjectURL, revokeObjectURL, downloads };
  }

  // jsdom 没有画布实现：编码结果的长度按“像素数 × 质量”模拟，足以检验降质量和缩尺寸的循环。
  function fakeCanvas() {
    const context = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context as unknown as CanvasRenderingContext2D);
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockImplementation(function (this: HTMLCanvasElement, _type?: string, quality: unknown = 0.92) {
        return `data:image/jpeg,${"A".repeat(Math.round(this.width * this.height * Number(quality) * 0.5))}`;
      });
    return { context, toDataURL };
  }

  function fakeAlbum() {
    const saveImageToAlbum = vi.fn<(options: { base64Data: string }) => Promise<void>>(async () => {});
    window.toy = { isSupport: vi.fn(async () => true), saveImageToAlbum } as unknown as ToySdk;
    return saveImageToAlbum;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("网站：Blob 原样下载，不重新编码", async () => {
    vi.useFakeTimers();
    const { createObjectURL, revokeObjectURL, downloads } = captureDownloads();
    const { createWebPlatform } = await import("./web");
    const web = createWebPlatform();
    const png = new Blob(["png"], { type: "image/png" });
    await expect(web.saveImage(png, "水印.png")).resolves.toBe("downloaded");
    expect(createObjectURL.mock.calls[0]?.[0]).toBe(png);
    const csv = new Blob(["a,b"], { type: "text/csv" });
    await expect(web.saveFile(csv, "结果.csv")).resolves.toBe("downloaded");
    expect(createObjectURL.mock.calls[1]?.[0]).toBe(csv);
    expect(downloads).toEqual(["水印.png", "结果.csv"]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("TOY：大图转成白底 JPEG，缩到 2MB 以内再存相册", async () => {
    const { context, toDataURL } = fakeCanvas();
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 6000, height: 4000, close })));
    const saveImageToAlbum = fakeAlbum();
    const toy = await loadToy();
    await expect(toy.saveFile(new Blob(["x"], { type: "image/png" }), "大图.png")).resolves.toBe("saved");
    const data = saveImageToAlbum.mock.calls[0]?.[0].base64Data ?? "";
    expect(data.startsWith("data:image/jpeg")).toBe(true);
    expect(data.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", expect.any(Number));
    expect(context.fillStyle).toBe("#fff");
    expect(close).toHaveBeenCalled();
  });

  it("TOY：非图片文件返回 unsupported，不尝试下载也不调 SDK", async () => {
    const { createObjectURL } = captureDownloads();
    const saveImageToAlbum = fakeAlbum();
    const toy = await loadToy();
    await expect(toy.saveFile(new Blob(["a,b"], { type: "text/csv" }), "结果.csv")).resolves.toBe("unsupported");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(saveImageToAlbum).not.toHaveBeenCalled();
  });
});
