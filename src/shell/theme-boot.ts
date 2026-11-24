// 不依赖 React 和 ~ 别名：vite.toy.config.ts 在 Node 里直接导入它，注入 TOY 的 index.html。
import { localKey } from "../platform/browser.ts";

export const THEME_STORE = { namespace: "site", key: "theme" } as const;

/**
 * 放进 <head> 的启动脚本：页面画出来之前就把访客选过的主题写到 html[data-theme]，避免先闪一下另一套颜色。
 * 网站（src/web/root.tsx）和 TOY（vite.toy.config.ts）共用。读的键和格式与 platform.storage.local 一致。
 */
export const themeBootScript = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(localKey(THEME_STORE.namespace, THEME_STORE.key))}));if(v==="night"||v==="dawn")document.documentElement.dataset.theme=v}catch(e){}})()`;
