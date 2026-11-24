export type BiliTarget = "video" | "space" | "opus";
/** saved：已存进 TOY 相册；downloaded：网站已触发下载；shown：存不了，已弹出图片让用户长按保存。 */
export type SaveImageResult = "saved" | "downloaded" | "shown";
/** unsupported：这个平台存不了这种文件（TOY 里的非图片），调用方提示用户去网站版。 */
export type SaveFileResult = SaveImageResult | "unsupported";
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
  /**
   * 网站：Blob 原样下载（格式、透明、EXIF 都不变），画布按 filename 后缀编码成 PNG 或 JPEG 下载。
   * TOY：一律转成白底 JPEG 存进相册，先降质量、再缩尺寸，让数据尽量 ≤2MB、绝不超过 SDK 的 5MB 上限；filename 不用。
   * SDK 存完没有任何系统提示，调用方必须按结果自己弹轻提示（"saved" 时提示“已存到相册”）。
   * 都不行时弹出图片让用户长按保存，返回 "shown"。图片解码或编码失败时抛出带中文说明的错误。
   */
  saveImage(image: HTMLCanvasElement | Blob, filename: string): Promise<SaveImageResult>;
  /**
   * 网站：任意文件触发下载，返回 "downloaded"。
   * TOY：image/* 走 saveImage 的相册路径；其他类型不尝试下载（App 里的下载没验证过），返回 "unsupported"。
   */
  saveFile(blob: Blob, filename: string): Promise<SaveFileResult>;
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
    /**
     * 只有网站有：读重构前的旧站点在同一域名下写的 localStorage 原始键（不带 henji: 前缀），用于一次性导入旧数据。
     * 只读不写，旧键留着不动。TOY 从来没有旧数据，所以没有这个方法。
     */
    legacy?(key: string): Promise<unknown>;
  };
  /** 全屏。网站把 element（默认整页）切到浏览器全屏；TOY 切 App 的沉浸模式。返回是否成功。 */
  setImmersive(on: boolean, element?: HTMLElement | null): Promise<boolean>;
  /** 浏览器全屏被 Esc 等方式退出时通知。 */
  onImmersiveChange(listener: (on: boolean) => void): () => void;
}
