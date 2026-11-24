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

// 只缓存 SDK 真正给出的答案。超时和报错只让这一次调用当作不支持：App 刚启动时 SDK 可能还没准备好，
// 缓存下来的话整个页面生命周期里这项能力都用不了。同时发起的调用共用一个请求；超时后下一次调用重新问，
// 迟到的答案照样记下。
const abilityCache = new Map<ToyAbility, boolean>();
const abilityRequests = new Map<ToyAbility, Promise<boolean | undefined>>();
async function supports(ability: ToyAbility): Promise<boolean> {
  const known = abilityCache.get(ability);
  if (known !== undefined) return known;
  const t = sdk();
  if (!t?.isSupport) return false;
  let request = abilityRequests.get(ability);
  if (!request) {
    const created = t.isSupport(ability).then(
      (answer) => {
        abilityCache.set(ability, Boolean(answer));
        return Boolean(answer);
      },
      () => undefined,
    );
    request = created;
    abilityRequests.set(ability, created);
    void created.then(() => {
      if (abilityRequests.get(ability) === created) abilityRequests.delete(ability);
    });
  }
  const answer = await withTimeout(request, SUPPORT_TIMEOUT, undefined);
  if (answer === undefined && abilityRequests.get(ability) === request) abilityRequests.delete(ability);
  return Boolean(answer);
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

/** 写入失败后的重试间隔：从 2 秒起翻倍，最多 1 分钟；被限频（错误码 307044）时至少等 10 秒。 */
const RETRY_BASE = 2000;
const RETRY_MAX = 60_000;
const RATE_LIMIT_WAIT = 10_000;
const RATE_LIMIT_CODE = 307044;

type Entry = { raw: string; gen: number };
/** 还没写到云端的值。gen 是这个键第几次修改，写入失败时用来判断有没有更新的值已经取代它。 */
const pending = new Map<string, Entry>();
const generations = new Map<string, number>();
/** 已经发出、还没有结果的值。页面隐藏时连同它们一起强制重写一遍：它们要是在页面没了之后才失败，就再也没机会重试。 */
const inFlight = new Map<string, Entry>();
/** 每个键已确认写进云端的最新 gen：早发的写入迟到失败时，不把已被后来的写入覆盖的值放回待写。 */
const acked = new Map<string, number>();
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let failures = 0;
/** 在这之前不发起写入（重试退避或限频中）。 */
let blockedUntil = 0;
let listening = false;

function scheduleFlush(delay: number): void {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushCloud(), Math.max(delay, blockedUntil - Date.now()));
}

// SDK 没有公开错误对象的结构，错误码可能在 code / errCode / errno 字段里，也可能只出现在消息文字里
function isRateLimited(error: unknown): boolean {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if ([e.code, e.errCode, e.errno].some((c) => Number(c) === RATE_LIMIT_CODE)) return true;
  }
  return String((error as { message?: unknown } | null)?.message ?? error).includes(String(RATE_LIMIT_CODE));
}

const isCurrent = (key: string, entry: Entry) => generations.get(key) === entry.gen && (acked.get(key) ?? 0) < entry.gen;

/**
 * 把待写的值发出去，返回是否都已写进云端（没有待写的也算）。
 * force：页面要隐藏或关闭了，这可能是最后的机会。不管退避，并把还没有结果的写入一起重发；被限频就认了。
 */
async function flushCloud(force = false): Promise<boolean> {
  clearTimeout(flushTimer);
  flushTimer = undefined;
  const batch = new Map(pending);
  if (force) {
    for (const [key, entry] of inFlight) if (!batch.has(key) && isCurrent(key, entry)) batch.set(key, entry);
  }
  if (!batch.size) return true;
  // 退避中不发，否则只会再撞一次限频
  if (!force && Date.now() < blockedUntil) {
    scheduleFlush(0);
    return false;
  }
  // 云存储用不了（App 外、或这次没问到）时留在待写里，下次修改或页面隐藏时再试；本机镜像里一直有最新值
  const t = sdk();
  if (!t || !(await supports("setCloudStorage"))) return false;
  for (const key of batch.keys()) pending.delete(key);
  for (const [key, entry] of batch) inFlight.set(key, entry);
  const settle = () => {
    for (const [key, entry] of batch) if (inFlight.get(key) === entry) inFlight.delete(key);
  };
  try {
    await t.setCloudStorage(Object.fromEntries([...batch].map(([k, { raw }]) => [k, raw])));
    settle();
    for (const [key, entry] of batch) {
      acked.set(key, Math.max(acked.get(key) ?? 0, entry.gen));
      // 同一个值的另一次写入迟到失败、已经放回待写的，这次写上了就不用再发
      if (pending.get(key) === entry) pending.delete(key);
    }
    failures = 0;
    blockedUntil = 0;
    return true;
  } catch (error) {
    settle();
    // 放回待写；等待期间又改过的键已经有更新的值在排队，已被其他写入确认的也不用再写
    for (const [key, entry] of batch) {
      if (isCurrent(key, entry) && !pending.has(key)) pending.set(key, entry);
    }
    failures += 1;
    const wait = Math.min(RETRY_MAX, RETRY_BASE * 2 ** (failures - 1));
    blockedUntil = Date.now() + (isRateLimited(error) ? Math.max(wait, RATE_LIMIT_WAIT) : wait);
    if (pending.size) scheduleFlush(0);
    return false;
  }
}

function listenForHide(): void {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushCloud(true);
  });
  window.addEventListener("pagehide", () => void flushCloud(true));
  void supports("onPageClose").then((ok) => {
    if (ok) sdk()?.onPageClose?.(() => void flushCloud(true));
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
    const gen = (generations.get(ck) ?? 0) + 1;
    generations.set(ck, gen);
    pending.set(ck, { raw, gen });
    listenForHide();
    scheduleFlush(CLOUD_WRITE_DELAY);
  }
  return {
    async get<T>(key: string) {
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
      // 等云端的这段时间里本机可能刚写过，所以读完云端再读镜像。两边都有时取更新的那份（另一台设备改过时云端更新）
      const local = readLocalJson<Envelope>(mirrorKey(namespace, key));
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
      flush: () => flushCloud(),
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
