// B 站 TOY 平台：页面跑在 www.bilibilitoy.com 的 iframe 里，B 站能力走官方 SDK。
// 以下行为都是第 0 阶段在 App 里实测的结论（docs/development-plan.md 第 9 节）：剪贴板接口被拒；
// 存相册没有系统提示；侧滑返回直接退出 TOY、从别的页面回来可能整页重载，所以状态要随时落盘。
import {
  biliUrl,
  browserFullscreen,
  execCopy,
  localKey,
  localStore,
  onFullscreenChange,
  openWindow,
  readLocalJson,
  selectContents,
  writeLocalJson,
} from "./browser";
import type { KeyValueStore, Platform, SaveImageResult } from "./contract";
import { presentImage } from "./present";
import type { ToyAbility, ToySdk } from "./types/toy";

/** 云存储单个值的上限（字节）。 */
const CLOUD_VALUE_LIMIT = 1024;
/** 云存储有频率限制：停止修改这么久之后才合并写一次；页面隐藏时立即写。 */
const CLOUD_WRITE_DELAY = 1200;
/** SDK 的 isSupport 在 App 外可能一直不返回，超时就当不支持。 */
const SUPPORT_TIMEOUT = 1500;
const CLOUD_READ_TIMEOUT = 2500;
// saveImageToAlbum 的 base64 上限 5MB，官方建议 2MB 内（sharePicture 上限 2MB）。
// 文档没说按解码后字节还是按字符串算，这里按整个 data URL 的字符数算，偏保守。
const IMAGE_TARGET_LENGTH = 2 * 1024 * 1024;
const IMAGE_LIMIT_LENGTH = 5 * 1024 * 1024;
/** iOS WebKit 的画布面积上限约 1677 万像素，超过时拿不到绘图上下文或画出空白，所以先缩到这个面积内。 */
const CANVAS_MAX_PIXELS = 16_777_216;
const JPEG_QUALITIES = [0.9, 0.8, 0.7, 0.6];
/** 每轮缩小后重新试一遍各档质量；8 轮每轮至少缩到 80%，任何尺寸都能压到目标以内。 */
const MAX_SCALE_ROUNDS = 8;

type Envelope = { t: number; v: unknown };

function sdk(): ToySdk | undefined {
  return typeof window === "undefined" ? undefined : window.toy;
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

const abilityCache = new Map<ToyAbility, Promise<boolean>>();
function supports(ability: ToyAbility): Promise<boolean> {
  let cached = abilityCache.get(ability);
  if (!cached) {
    const t = sdk();
    cached = t?.isSupport
      ? withTimeout(
          t.isSupport(ability).then(Boolean, () => false),
          SUPPORT_TIMEOUT,
          false,
        )
      : Promise.resolve(false);
    abilityCache.set(ability, cached);
  }
  return cached;
}

function utf8Length(text: string): number {
  return new TextEncoder().encode(text).length;
}

function cloudKey(namespace: string, key: string): string {
  return `${namespace}_${key}`.replace(/[^A-Za-z0-9_]/g, "_");
}

// 写云存储前先写本机镜像：云端写入是延迟合并的，镜像保证重载后马上能读到最新值，也是云存储不可用时的退路。
function mirrorKey(namespace: string, key: string): string {
  return `${localKey(namespace, key)}@cloud`;
}

const pending = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;

async function flushCloud(): Promise<void> {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  if (!pending.size) return;
  const batch = Object.fromEntries(pending);
  pending.clear();
  const t = sdk();
  if (!t || !(await supports("setCloudStorage"))) return;
  try {
    await t.setCloudStorage(batch);
  } catch {
    // 频率限制或网络问题：本机镜像里有最新值，下次修改时会再写
  }
}

function listenForHide(): void {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushCloud();
  });
  window.addEventListener("pagehide", () => void flushCloud());
  void supports("onPageClose").then((ok) => {
    if (ok) sdk()?.onPageClose?.(() => void flushCloud());
  });
}

const warnedKeys = new Set<string>();

function cloudStore(namespace: string): KeyValueStore {
  async function write(key: string, value: unknown) {
    const envelope: Envelope = { t: Date.now(), v: value };
    writeLocalJson(mirrorKey(namespace, key), envelope);
    const raw = JSON.stringify(envelope);
    const ck = cloudKey(namespace, key);
    if (utf8Length(raw) > CLOUD_VALUE_LIMIT) {
      // 超过云存储上限的只留在本机。这是调用方的问题：大输入应该用 storage.local。
      if (!warnedKeys.has(ck)) console.warn(`[platform] ${ck} 超过云存储 1KB 上限，只存在本机`);
      warnedKeys.add(ck);
      return;
    }
    pending.set(ck, raw);
    listenForHide();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => void flushCloud(), CLOUD_WRITE_DELAY);
  }
  return {
    async get<T>(key: string) {
      const local = readLocalJson<Envelope>(mirrorKey(namespace, key));
      let remote: Envelope | undefined;
      const t = sdk();
      if (t && (await supports("getCloudStorage"))) {
        const ck = cloudKey(namespace, key);
        const values = await withTimeout(
          t.getCloudStorage([ck]).catch(() => ({}) as Record<string, string | undefined>),
          CLOUD_READ_TIMEOUT,
          {} as Record<string, string | undefined>,
        );
        try {
          const raw = values[ck];
          if (raw) remote = JSON.parse(raw) as Envelope;
        } catch {
          remote = undefined;
        }
      }
      // 两边都有时取更新的那份（另一台设备改过时云端更新）
      const pick = remote && (!local || remote.t > local.t) ? remote : local;
      if (pick && pick === remote) writeLocalJson(mirrorKey(namespace, key), remote);
      return (pick?.v ?? undefined) as T | undefined;
    },
    set: write,
    remove: (key) => write(key, null),
  };
}

type Drawable = HTMLCanvasElement | ImageBitmap;

async function decodeImage(image: HTMLCanvasElement | Blob): Promise<Drawable> {
  if (!(image instanceof Blob)) return image;
  try {
    // 默认按 EXIF 方向摆正，和网站上看到的一致
    return await createImageBitmap(image);
  } catch {
    throw new Error("这张图片读不出来，换成 PNG 或 JPEG 再试");
  }
}

function render(source: Drawable, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("图片太大，浏览器生成不了，换小一点的尺寸再试");
  // JPEG 没有透明通道，不铺底的话透明处会变成黑色
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 转成给 SDK 的 JPEG data URL：先降质量，还超过 2MB 就缩尺寸；结果不会超过 5MB，做不到就抛错。 */
async function toAlbumJpeg(image: HTMLCanvasElement | Blob): Promise<string> {
  const source = await decodeImage(image);
  try {
    let scale = Math.min(1, Math.sqrt(CANVAS_MAX_PIXELS / (source.width * source.height || 1)));
    let data = "";
    for (let round = 0; round < MAX_SCALE_ROUNDS; round++) {
      const canvas = render(source, scale);
      for (const quality of JPEG_QUALITIES) {
        data = canvas.toDataURL("image/jpeg", quality);
        if (data.length <= IMAGE_TARGET_LENGTH) return data;
      }
      // 按面积和数据量近似成正比估算缩放比例，乘 0.9 留余量少走一轮
      scale *= Math.min(0.8, Math.sqrt(IMAGE_TARGET_LENGTH / data.length) * 0.9);
    }
    if (data.length <= IMAGE_LIMIT_LENGTH) return data;
    throw new Error("图片太大，存不进相册，换小一点的尺寸再试");
  } finally {
    if (!(source instanceof HTMLCanvasElement)) source.close();
  }
}

async function saveImage(image: HTMLCanvasElement | Blob): Promise<SaveImageResult> {
  const data = await toAlbumJpeg(image);
  const t = sdk();
  if (t && (await supports("saveImageToAlbum"))) {
    try {
      await t.saveImageToAlbum({ base64Data: data, hintMsg: "需要相册权限来保存图片" });
      return "saved";
    } catch {
      // 没给相册权限等：退回显示图片
    }
  }
  presentImage(data);
  return "shown";
}

export function createToyPlatform(): Platform {
  if (typeof window !== "undefined") {
    // 提前问一遍能力：之后在点击事件里调用 SDK 时不用再等，避免丢掉“用户点击触发”的上下文。
    for (const a of ["navigate", "saveImageToAlbum", "sharePicture", "getCloudStorage", "setCloudStorage", "setContainerMode"] as const) void supports(a);
  }
  return {
    kind: "toy",
    async openBili(type, id) {
      const t = sdk();
      if (t && (await supports("navigate"))) {
        await t.navigate({ type, id });
        return;
      }
      openWindow(biliUrl(type, id));
    },
    openExternal: openWindow,
    saveImage,
    async saveFile(blob) {
      if (!blob.type.startsWith("image/")) return "unsupported";
      return saveImage(blob);
    },
    async copyText(text, source) {
      if (execCopy(text)) return "copied";
      if (source) {
        selectContents(source);
        return "selected";
      }
      return "failed";
    },
    async shareImage(canvas) {
      const t = sdk();
      if (!t || !(await supports("sharePicture"))) throw new Error("这里分享不了图片，先保存到相册再发");
      await t.sharePicture({ base64Data: await toAlbumJpeg(canvas) });
    },
    storage: {
      settings: cloudStore,
      local: localStore,
      flush: flushCloud,
    },
    async setImmersive(on, element) {
      const t = sdk();
      if (t && (await supports("setContainerMode"))) {
        try {
          await t.setContainerMode({ immersive: on });
          return true;
        } catch {
          return false;
        }
      }
      return browserFullscreen(on, element);
    },
    onImmersiveChange: onFullscreenChange,
  };
}
