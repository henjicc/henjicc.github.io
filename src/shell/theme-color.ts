/**
 * 手机浏览器地址栏、状态栏的颜色（meta theme-color）跟着当前主题的 ground 走。颜色从令牌读，不在这里另写一份，
 * 所以要等样式表生效后再算。按需加载：首页首屏的脚本预算只剩几 KB，这点功能不值得占。
 */
export function syncThemeColor() {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = getComputedStyle(document.documentElement).getPropertyValue("--ground").trim();
}

/** 水合后同步一次；跟随系统时，系统切换深浅色也跟着换。 */
export function watchThemeColor() {
  syncThemeColor();
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", syncThemeColor);
}
