import { flushSync } from "react-dom";
import { create } from "zustand";
import { platform } from "~/platform";
import { prefersReducedMotion } from "./media";
import { THEME_STORE } from "./theme-boot";

export type ThemeChoice = "night" | "dawn" | "system";
export type Theme = "night" | "dawn";

function initialChoice(): ThemeChoice {
  if (typeof document === "undefined") return "system";
  const t = document.documentElement.dataset.theme;
  return t === "night" || t === "dawn" ? t : "system";
}

export const useThemeStore = create<{ choice: ThemeChoice }>(() => ({ choice: initialChoice() }));

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "dawn" : "night";
}

function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") delete root.dataset.theme;
  else root.dataset.theme = choice;
  useThemeStore.setState({ choice });
  void platform.storage.local(THEME_STORE.namespace).set(THEME_STORE.key, choice === "system" ? undefined : choice);
}

function cssMs(name: string): number {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
}

/**
 * 切到另一套主题：新主题从 origin（通常是切换按钮的中心）以圆形扩散盖住整页，dur-scene + ease-in-out。
 * 不支持 View Transitions 或开了“减少动态效果”时直接切换。
 */
export function toggleTheme(origin?: { x: number; y: number }) {
  const next: Theme = resolveTheme(useThemeStore.getState().choice) === "night" ? "dawn" : "night";
  if (!document.startViewTransition || prefersReducedMotion()) {
    applyChoice(next);
    return;
  }
  const root = document.documentElement;
  const x = origin?.x ?? window.innerWidth - 60;
  const y = origin?.y ?? 32;
  root.classList.add("vt-theme");
  const transition = document.startViewTransition(() => flushSync(() => applyChoice(next)));
  transition.ready
    .then(() => {
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: cssMs("--dur-scene"),
          easing: getComputedStyle(root).getPropertyValue("--ease-in-out").trim() || "ease-in-out",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {});
  void transition.finished.finally(() => root.classList.remove("vt-theme"));
}

export function originOf(element: Element): { x: number; y: number } {
  const r = element.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
