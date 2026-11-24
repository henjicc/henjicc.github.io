import type { CopyResult, SaveFileResult } from "~/platform";
import { toast } from "~/ui/sonner";

/**
 * 当前页面的来源，用来判断 HTTPS 页面请求 HTTP 地址会不会被浏览器拦下。
 * 只读协议，不跳转也不改地址，所以不经平台适配层；window.location 被 ESLint 拦着，用 window.origin。
 */
export function pageOrigin(): string {
  return window.origin;
}

export function reportSave(result: SaveFileResult, success: string) {
  if (result === "unsupported") toast.error("这里存不了文件，请在 henjihenji.com 上使用");
  else toast.success(success);
}

export function reportCopy(result: CopyResult) {
  if (result === "copied") toast.success("已复制");
  else if (result === "selected") toast("复制不了，已选中文字，请长按复制");
  else toast.error("复制不了，请手动选中文字复制");
}
