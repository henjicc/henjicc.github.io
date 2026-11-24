// 两个平台共用的浏览器实现。只在事件处理和副作用里调用，模块加载时不碰 window（预渲染在 Node 里执行）。
import type { BiliTarget, KeyValueStore } from "./contract";

export function biliUrl(type: BiliTarget, id: string): string {
  if (type === "video") return `https://www.bilibili.com/video/${id}`;
  if (type === "space") return `https://space.bilibili.com/${id}`;
  return `https://www.bilibili.com/opus/${id}`;
}

export function openWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** localStorage 里的键：henji:<命名空间>:<键>。主题的启动脚本（src/shell/theme.ts）也按这个格式读。 */
export function localKey(namespace: string, key: string): string {
  return `henji:${namespace}:${key}`;
}

function readRaw(fullKey: string): string | null {
  try {
    return localStorage.getItem(fullKey);
  } catch {
    // 无痕模式、存储被禁用：当作没有存过
    return null;
  }
}

function writeRaw(fullKey: string, raw: string | null): void {
  try {
    if (raw === null) localStorage.removeItem(fullKey);
    else localStorage.setItem(fullKey, raw);
  } catch {
    // 存储满了或被禁用：这次不记住，界面照常工作
  }
}

export function readLocalJson<T>(fullKey: string): T | undefined {
  const raw = readRaw(fullKey);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function writeLocalJson(fullKey: string, value: unknown): void {
  writeRaw(fullKey, value === undefined ? null : JSON.stringify(value));
}

export function localStore(namespace: string): KeyValueStore {
  return {
    async get<T>(key: string) {
      return readLocalJson<T>(localKey(namespace, key));
    },
    async set<T>(key: string, value: T) {
      writeLocalJson(localKey(namespace, key), value);
    },
    async remove(key: string) {
      writeRaw(localKey(namespace, key), null);
    },
  };
}

export async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const type = /\.jpe?g$/i.test(filename) ? "image/jpeg" : "image/png";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
  if (!blob) throw new Error("图片太大，浏览器生成不了，换小一点的尺寸再试");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 老办法复制：选中一个看不见的文本框再执行 copy。TOY 里剪贴板接口被拒时它通常还能用。 */
export function execCopy(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  area.readOnly = true;
  // 16px 防止 iOS 聚焦时放大页面；移出视口但保持可选中
  area.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;font-size:16px";
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export function selectContents(element: HTMLElement): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    element.select();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export async function browserFullscreen(on: boolean, element?: HTMLElement | null): Promise<boolean> {
  try {
    if (on) {
      const target = element ?? document.documentElement;
      if (!target.requestFullscreen) return false;
      await target.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export function onFullscreenChange(listener: (on: boolean) => void): () => void {
  const handler = () => listener(Boolean(document.fullscreenElement));
  document.addEventListener("fullscreenchange", handler);
  return () => document.removeEventListener("fullscreenchange", handler);
}
