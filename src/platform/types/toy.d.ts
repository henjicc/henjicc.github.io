// B 站 TOY JS SDK（https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js）的最小类型声明。
// 没拿到官方 toy.d.ts，这里只写本项目用到、并且第 0 阶段在 B 站 App 里实测过调用方式的方法；
// 拿到官方声明后整体替换这个文件。所有方法只在 App 里可用，调用前先用 isSupport 判断。

export type ToyAbility =
  | "navigate"
  | "saveImageToAlbum"
  | "share"
  | "sharePicture"
  | "getQrCode"
  | "closeBrowser"
  | "getCloudStorage"
  | "setCloudStorage"
  | "getContainerState"
  | "onContainerChange"
  | "setContainerMode"
  | "onPageClose";

export interface ToySdk {
  isSupport(ability: ToyAbility): Promise<boolean>;
  /** 在 App 里原生打开视频、空间、动态；需要用户点击触发。 */
  navigate(target: { type: "video" | "space" | "opus"; id: string }): Promise<unknown>;
  /** base64Data 传完整的 data URL；上限 5MB，建议 2MB 内。存完没有任何提示。 */
  saveImageToAlbum(options: { base64Data: string; hintMsg?: string }): Promise<unknown>;
  /** 分享当前 TOY 里的页面，path 相对 TOY 根目录，如 "index.html?p=/tools/random-picker"。 */
  share(options: { path: string }): Promise<unknown>;
  /** 分享图片本身，≤2MB。 */
  sharePicture(options: { base64Data: string }): Promise<unknown>;
  getQrCode(options: { path: string; size?: number }): Promise<{ base64: string; url: string }>;
  /** 按“用户 + 本 TOY”隔离；最多 128 个键，每个值 ≤1KB，有频率限制。 */
  getCloudStorage(keys: string[]): Promise<Record<string, string | undefined>>;
  setCloudStorage(values: Record<string, string>): Promise<unknown>;
  setContainerMode(options: { immersive: boolean }): Promise<unknown>;
  onPageClose?(listener: () => void): unknown;
}

declare global {
  interface Window {
    toy?: ToySdk;
  }
}
