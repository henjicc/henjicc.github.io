import type { Platform } from "./contract";
import { createToyPlatform } from "./toy";
import { createWebPlatform } from "./web";

// __PLATFORM__ 是构建时常量，没用到的那一份实现会被打包器整个去掉。
export const platform: Platform = __PLATFORM__ === "toy" ? createToyPlatform() : createWebPlatform();

// localKey：storage.local 在 localStorage 里用的键，两个平台相同；工具在 storage 事件里靠它认出自己的那一项
export { biliUrl, localKey } from "./browser";
export type { BiliTarget, CopyResult, KeyValueStore, Platform, SaveFileResult, SaveImageResult } from "./contract";
export { setImagePresenter } from "./present";
