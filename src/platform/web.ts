import {
  biliUrl,
  browserFullscreen,
  downloadBlob,
  downloadCanvas,
  execCopy,
  localStore,
  onFullscreenChange,
  openWindow,
  readLocalJson,
  selectContents,
} from "./browser";
import type { Platform } from "./contract";

export function createWebPlatform(): Platform {
  return {
    kind: "web",
    async openBili(type, id) {
      openWindow(biliUrl(type, id));
    },
    openExternal: openWindow,
    async saveImage(image, filename) {
      if (image instanceof Blob) downloadBlob(image, filename);
      else await downloadCanvas(image, filename);
      return "downloaded";
    },
    async saveFile(blob, filename) {
      downloadBlob(blob, filename);
      return "downloaded";
    },
    async copyText(text, source) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return "copied";
        }
      } catch {
        // 没有权限或不是安全上下文：退回老办法
      }
      if (execCopy(text)) return "copied";
      if (source) {
        selectContents(source);
        return "selected";
      }
      return "failed";
    },
    storage: {
      settings: localStore,
      local: localStore,
      // 设置直接写 localStorage，没有待发送的
      async flush() {
        return true;
      },
      async legacy(key) {
        return readLocalJson(key);
      },
    },
    setImmersive: browserFullscreen,
    onImmersiveChange: onFullscreenChange,
  };
}
