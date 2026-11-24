import type { CopyResult, SaveFileResult } from "~/platform";
import { toast } from "~/ui/sonner";

/**
 * 当前页面是不是安全上下文，用来判断请求 HTTP 地址会不会被浏览器当作混合内容拦下。
 * 只读一个浏览器标志，两个平台含义相同，所以不经平台适配层。
 */
export function secureContext(): boolean {
  return window.isSecureContext;
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
