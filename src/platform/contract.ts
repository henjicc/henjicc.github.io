export type BiliTarget = "video" | "space" | "opus";
export type SaveImageResult = "saved" | "downloaded" | "shown";
/** copied：已进剪贴板；selected：复制不了，已选中给的元素让用户长按复制；failed：复制不了也没有可选中的元素。 */
export type CopyResult = "copied" | "selected" | "failed";

/** 值都是能 JSON 序列化的数据。 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

// 页面和工具只通过它使用平台能力，不判断自己在哪个平台。网站和 TOY 的差异见 docs/development-plan.md 第 3 节。
export interface Platform {
  kind: "web" | "toy";
  /** B 站内的页面：TOY 里用 SDK 原生打开（必须在点击事件里调用），网站和其他环境开新窗口。 */
  openBili(type: BiliTarget, id: string): Promise<void>;
  openExternal(url: string): void;
  /** 网站触发下载；TOY 存进相册（先压成 JPEG）；都不行时弹出图片让用户长按保存。调用方按结果弹轻提示。 */
  saveImage(canvas: HTMLCanvasElement, filename: string): Promise<SaveImageResult>;
  /** TOY 里剪贴板接口被拒，按 execCommand → 选中 source 的顺序退回。 */
  copyText(text: string, source?: HTMLElement | null): Promise<CopyResult>;
  /** 只有 TOY 有：分享图片本身（≤2MB）。 */
  shareImage?(canvas: HTMLCanvasElement): Promise<void>;
  storage: {
    /** 小设置（单个值 ≤1KB）：TOY 存 B 站云存储，按“用户 + 本 TOY”隔离，停止修改后合并写入、页面隐藏时立即写；网站存 localStorage。 */
    settings(namespace: string): KeyValueStore;
    /** 较大的输入（名单、文本）和需要随时保存的进度：两边都存 localStorage，防止侧滑退出或重新加载后丢失。 */
    local(namespace: string): KeyValueStore;
    /** 立即写出所有还没发送的设置。 */
    flush(): Promise<void>;
  };
  /** 全屏。网站把 element（默认整页）切到浏览器全屏；TOY 切 App 的沉浸模式。返回是否成功。 */
  setImmersive(on: boolean, element?: HTMLElement | null): Promise<boolean>;
  /** 浏览器全屏被 Esc 等方式退出时通知。 */
  onImmersiveChange(listener: (on: boolean) => void): () => void;
}
