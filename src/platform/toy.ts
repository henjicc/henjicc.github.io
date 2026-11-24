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
import type { KeyValueStore, Platform } from "./contract";
import { presentImage } from "./present";
import type { ToyAbility, ToySdk } from "./types/toy";

/** 云存储单个值的上限（字节）。 */
const CLOUD_VALUE_LIMIT = 1024;
/** 云存储有频率限制：停止修改这么久之后才合并写一次；页面隐藏时立即写。 */
const CLOUD_WRITE_DELAY = 1200;
/** SDK 的 isSupport 在 App 外可能一直不返回，超时就当不支持。 */
const SUPPORT_TIMEOUT = 1500;
const CLOUD_READ_TIMEOUT = 2500;
/** saveImageToAlbum 的 base64 上限 5MB，官方建议 2MB 内。 */
const IMAGE_TARGET_BYTES = 2 * 1024 * 1024;

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

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  let quality = 0.9;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length * 0.75 > IMAGE_TARGET_BYTES && quality > 0.55) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  return data;
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
    async saveImage(canvas) {
      const data = canvasToJpeg(canvas);
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
      await t.sharePicture({ base64Data: canvasToJpeg(canvas) });
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
