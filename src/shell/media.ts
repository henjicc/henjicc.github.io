import { useSyncExternalStore } from "react";

/** 和 Tailwind 的 md 断点一致：窄于它用手机布局（工具页换成底部抽屉）。 */
export const MOBILE_QUERY = "(max-width: 767.98px)";

function subscribeMedia(query: string) {
  return (onChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  };
}

const subscribeMobile = subscribeMedia(MOBILE_QUERY);

/** 预渲染和水合时按桌面算，水合后才换成真实值；只在客户端渲染的地方（工具外壳、TOY）一开始就是真实值。 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

const noop = () => () => {};

/** 水合完成后为 true。用来把只能在浏览器里算的内容（读存储、看屏幕宽度）推迟到水合之后，避免和预渲染的 HTML 对不上。 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
