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

describe("复制时的焦点", () => {
  it("对话框打开时文本框放进对话框里，复制完焦点回到原来的元素", async () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);
    button.focus();
    let host: Element | null = null;
    let selected = "";
    document.execCommand = vi.fn(() => {
      const area = document.activeElement as HTMLTextAreaElement;
      host = area.parentElement;
      selected = area.value.slice(area.selectionStart, area.selectionEnd);
      return true;
    });
    const { execCopy } = await import("./browser");
    expect(execCopy("密钥")).toBe(true);
    expect(host).toBe(dialog);
    expect(selected).toBe("密钥");
    expect(document.activeElement).toBe(button);
    expect(dialog.querySelector("textarea")).toBeNull();
    dialog.remove();
  });
});

describe("TOY 能力判断", () => {
  it("isSupport 超时只让这一次当作不支持，下次重新问", async () => {
    vi.useFakeTimers();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const navigate = vi.fn(async () => {});
    // 第一次一直不返回（App 刚启动 SDK 还没就绪），之后正常回答
    const isSupport = vi.fn<() => Promise<boolean>>(() => new Promise(() => {}));
    window.toy = { isSupport, navigate } as unknown as ToySdk;
    const toy = await loadToy();
    const first = toy.openBili("video", "BV1xx");
    await vi.advanceTimersByTimeAsync(1600);
    await first;
    expect(open).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    isSupport.mockImplementation(async () => true);
    await toy.openBili("video", "BV1xx");
    expect(navigate).toHaveBeenCalledWith({ type: "video", id: "BV1xx" });
    expect(open).toHaveBeenCalledTimes(1);
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

  function hidePage() {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  }

  it("退避中页面隐藏：不等退避，立即强制写一次", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage, cloud } = fakeSdk();
    setCloudStorage.mockRejectedValueOnce(new Error("network"));
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("k", "值");
    await vi.advanceTimersByTimeAsync(1200);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    // 第一次失败后要等 2 秒才重试，页面这时被隐藏
    hidePage();
    await vi.advanceTimersByTimeAsync(0);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    expect(JSON.parse(cloud.t_k ?? "{}").v).toBe("值");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
  });

  it("页面隐藏时还没有结果的写入一起重发；它之后迟到失败也不会再放回待写", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage, cloud } = fakeSdk();
    let rejectFirst: (error: unknown) => void = () => {};
    setCloudStorage.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectFirst = reject;
        }),
    );
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("k", "值");
    await vi.advanceTimersByTimeAsync(1200);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    hidePage();
    await vi.advanceTimersByTimeAsync(0);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    expect(JSON.parse(cloud.t_k ?? "{}").v).toBe("值");
    rejectFirst(new Error("network"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
  });

  it("flush 等写入有了结果才返回，告诉调用方写没写上；退避中不发", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage } = fakeSdk();
    setCloudStorage.mockRejectedValueOnce(new Error("network"));
    window.toy = sdk;
    const toy = await loadToy();
    const store = toy.storage.settings("t");
    await expect(toy.storage.flush()).resolves.toBe(true);
    await store.set("k", 1);
    await expect(toy.storage.flush()).resolves.toBe(false);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    // 失败后的 2 秒退避里再 flush：不发，如实返回没写
    await expect(toy.storage.flush()).resolves.toBe(false);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    await store.set("k", 2);
    await expect(toy.storage.flush()).resolves.toBe(true);
    expect(setCloudStorage).toHaveBeenCalledTimes(3);
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

  it("写入失败时放回待写，已被更新值取代的键不放回；限频时至少等 10 秒再写", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage } = fakeSdk();
    let rejectFirst: (error: unknown) => void = () => {};
    setCloudStorage.mockImplementationOnce(
      () =>
        new Promise<void>((_, reject) => {
          rejectFirst = reject;
        }),
    );
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("a", 1);
    await store.set("k", 1);
    await vi.advanceTimersByTimeAsync(1300);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    // 第一次写还没返回时 k 又改了
    await store.set("k", 2);
    rejectFirst({ code: 307044, message: "rate limit" });
    await vi.advanceTimersByTimeAsync(9000);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1100);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    const retry = setCloudStorage.mock.calls[1]?.[0] ?? {};
    expect(JSON.parse(retry.t_a ?? "{}").v).toBe(1);
    expect(JSON.parse(retry.t_k ?? "{}").v).toBe(2);
  });

  it("普通失败按退避重试，成功后不再写", async () => {
    vi.useFakeTimers();
    const { sdk, setCloudStorage, cloud } = fakeSdk();
    setCloudStorage.mockRejectedValueOnce(new Error("network")).mockRejectedValueOnce(new Error("network"));
    window.toy = sdk;
    const store = (await loadToy()).storage.settings("t");
    await store.set("k", "值");
    await vi.advanceTimersByTimeAsync(1200);
    expect(setCloudStorage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    // 第二次失败后等 4 秒
    await vi.advanceTimersByTimeAsync(3900);
    expect(setCloudStorage).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(100);
    expect(setCloudStorage).toHaveBeenCalledTimes(3);
    expect(JSON.parse(cloud.t_k ?? "{}").v).toBe("值");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(setCloudStorage).toHaveBeenCalledTimes(3);
  });

  it("读云端期间本机写了新值时，返回本机的新值", async () => {
    const { sdk } = fakeSdk();
    let resolveCloud: (values: Record<string, string | undefined>) => void = () => {};
    const getCloudStorage = vi.fn(
      () =>
        new Promise<Record<string, string | undefined>>((resolve) => {
          resolveCloud = resolve;
        }),
    );
    window.toy = { ...sdk, getCloudStorage } as unknown as ToySdk;
    const store = (await loadToy()).storage.settings("t");
    const reading = store.get("k");
    await vi.waitFor(() => expect(getCloudStorage).toHaveBeenCalled());
    await store.set("k", "本机新");
    resolveCloud({ t_k: JSON.stringify({ t: 200, v: "云端旧" }) });
    await expect(reading).resolves.toBe("本机新");
    expect(JSON.parse(localStorage.getItem("henji:t:k@cloud") ?? "{}").v).toBe("本机新");
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
