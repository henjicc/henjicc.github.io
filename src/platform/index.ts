import type { Platform } from "./contract";
import { createToyPlatform } from "./toy";
import { createWebPlatform } from "./web";

// __PLATFORM__ 是构建时常量，没用到的那一份实现会被打包器整个去掉。
export const platform: Platform = __PLATFORM__ === "toy" ? createToyPlatform() : createWebPlatform();

export { biliUrl } from "./browser";
export type { BiliTarget, CopyResult, KeyValueStore, Platform, SaveFileResult, SaveImageResult } from "./contract";
export { setImagePresenter } from "./present";
