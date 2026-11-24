import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { setImagePresenter } from "~/platform";
import { getLiveTool } from "~/tools/lookup";
import { Footer } from "./Footer";
import { useShellRoute } from "./handle";
import { useHydrated, useIsMobile } from "./media";
import { preloadPalette, togglePalette, usePalette } from "./palette";
import { SiteHeader, useSceneHeaderMode } from "./SiteHeader";

// 浮层和轻提示都按需加载：首页首屏的包里只有 React、路由和页面本身（目标 gzip ≤145KB，见开发方案第 11 节）。
const CommandPalette = lazy(preloadPalette);
const ImagePreview = lazy(() => import("./ImagePreview"));
const Toaster = lazy(() => import("~/ui/sonner").then((m) => ({ default: m.Toaster })));

/** 全站外壳：顶栏、页脚、命令面板、轻提示。网站的 root.tsx 和 TOY 的入口都用它包住页面。 */
export function AppShell({ children }: { children: ReactNode }) {
  const { handle, toolId } = useShellRoute();
  const tool = toolId ? getLiveTool(toolId) : null;
  const hydrated = useHydrated();
  const mobile = useIsMobile();
  const headerMode = useSceneHeaderMode(handle.header === "scene" && !handle.tool);
  const paletteLoaded = usePalette((s) => s.loaded);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  // 手机上的工具页整页交给工具外壳（自己有返回和全屏），不显示站点顶栏。
  const toolFullscreen = Boolean(handle.tool && hydrated && mobile);

  useEffect(() => setImagePresenter(setPreviewSrc), []);

  // 外壳整个页面生命周期都在，不用取消监听
  useEffect(() => {
    void import("./theme-color").then((m) => m.watchThemeColor());
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {toolFullscreen ? null : (
        <SiteHeader
          mode={handle.tool ? "solid" : headerMode}
          tool={tool}
          // 场景页的顶栏压在照片上，不占位
          className={handle.header === "scene" && !handle.tool ? "-mb-16" : undefined}
        />
      )}
      <main>{children}</main>
      {handle.tool || handle.footer === false ? null : <Footer />}
      {/* 水合后才挂：轻提示只会在用户操作之后出现，那时它早就加载好了 */}
      {/* 每个浮层单独一个 Suspense：后加载的那个不会让已经挂好的轻提示被换掉 */}
      {hydrated ? (
        <Suspense fallback={null}>
          {/* 离底部留出工具操作栏的高度 */}
          <Toaster position={mobile ? "bottom-center" : "bottom-right"} offset={{ right: 24, bottom: 88 }} mobileOffset={{ left: 16, right: 16, bottom: 88 }} />
        </Suspense>
      ) : null}
      {paletteLoaded ? (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      ) : null}
      {previewSrc ? (
        <Suspense fallback={null}>
          <ImagePreview src={previewSrc} onClose={() => setPreviewSrc(null)} />
        </Suspense>
      ) : null}
    </>
  );
}
