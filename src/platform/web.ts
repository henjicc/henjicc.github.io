import {
  biliUrl,
  browserFullscreen,
  downloadCanvas,
  execCopy,
  localStore,
  onFullscreenChange,
  openWindow,
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
    async saveImage(canvas, filename) {
      await downloadCanvas(canvas, filename);
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
      async flush() {},
    },
    setImmersive: browserFullscreen,
    onImmersiveChange: onFullscreenChange,
  };
}
