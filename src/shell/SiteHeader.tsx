import { ChevronDown, Menu, Moon, Search, Sun } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import type { ToolEntry } from "~/tools/types";
import { Button } from "~/ui/button";
import { IconButton } from "~/ui/icon-button";
import { Kbd } from "~/ui/kbd";
import { cn } from "~/ui/lib/utils";
import { Logo } from "~/ui/logo";
import { iconBlock } from "~/ui/tool-card";
import { toolTransition } from "~/ui/vt";
import { isToy, toolsHome } from "./env";
import { useHydrated } from "./media";
import { sitePages } from "./nav";
import { preloadPalette, setPaletteOpen } from "./palette";
import { originOf, toggleTheme } from "./theme";

export type HeaderMode = "scene" | "bar" | "solid";

const modeClass: Record<HeaderMode, string> = {
  scene: "border-transparent text-on-scene",
  bar: "border-mist-line bg-mist-strong text-ink backdrop-blur-(--blur-bar) backdrop-saturate-120",
  solid: "border-line bg-[color-mix(in_srgb,var(--ground)_92%,transparent)] text-ink backdrop-blur-(--blur-bar)",
};

/** 首页首屏：透明压在照片上，滚过 64px 后变成雾层实底。 */
export function useSceneHeaderMode(scene: boolean): HeaderMode {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!scene) return;
    const onScroll = () => setScrolled(window.scrollY > 64);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scene]);
  return scene ? (scrolled ? "bar" : "scene") : "solid";
}

function useModKey(): string {
  const hydrated = useHydrated();
  return hydrated && /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
}

function ThemeButton({ scene }: { scene: boolean }) {
  return (
    <Button
      variant="ghost"
      aria-label="切换主题"
      className={cn("w-10 px-0", scene && "text-on-scene hover:not-disabled:bg-mist")}
      onClick={(e) => toggleTheme(originOf(e.currentTarget))}
    >
      <Sun aria-hidden className="dawn:hidden" />
      <Moon aria-hidden className="hidden dawn:block" />
    </Button>
  );
}

const MobileMenuDialog = lazy(() => import("./MobileMenu"));

function MobileMenu({ scene }: { scene: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <IconButton
        icon={Menu}
        label="菜单"
        aria-expanded={open}
        className={cn("md:hidden", scene && "text-on-scene hover:not-disabled:bg-mist")}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      />
      {loaded ? (
        <Suspense fallback={null}>
          <MobileMenuDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      ) : null}
    </>
  );
}

export function SiteHeader({ mode, tool, className }: { mode: HeaderMode; tool?: ToolEntry | null; className?: string }) {
  const mod = useModKey();
  const scene = mode === "scene";
  const nav = isToy ? [] : sitePages.filter((p) => p.inNav);
  return (
    <header data-vt className={cn("sticky top-0 z-30 [view-transition-name:site-head]", className)}>
      <div
        className={cn(
          "flex h-16 items-center gap-8 border-b pr-[max(var(--space-4),env(safe-area-inset-right))] pl-[max(var(--space-4),env(safe-area-inset-left))] transition-[background-color,border-color,color] duration-(--dur-base) ease-out md:px-12",
          modeClass[mode],
        )}
      >
        <Link to="/" viewTransition className="focus-ring flex items-center gap-3 rounded-sm text-[16px] font-bold tracking-[0.02em] whitespace-nowrap">
          <Logo size={24} />
          <span>痕继痕迹</span>
        </Link>

        {tool ? (
          <div className="hidden min-w-0 items-center gap-2 text-ui text-ink-muted md:flex">
            {toolsHome ? (
              <>
                <Link to={toolsHome} viewTransition className="focus-ring rounded-xs hover:text-sky-text">
                  小工具
                </Link>
                <span aria-hidden>/</span>
              </>
            ) : null}
            <b className="inline-flex items-center gap-2 font-semibold whitespace-nowrap text-ink">
              <span className={iconBlock(false, "sm")} {...toolTransition(tool.id, "icon")}>
                <tool.icon aria-hidden />
              </span>
              <span {...toolTransition(tool.id, "name")}>{tool.name}</span>
            </b>
            {toolsHome ? (
              <Button variant="ghost" size="sm" onClick={() => setPaletteOpen(true)} onPointerEnter={() => void preloadPalette()}>
                切换工具
                <ChevronDown aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : nav.length ? (
          <nav aria-label="主导航" className="hidden gap-1 md:flex">
            {nav.map((p) => (
              <NavLink
                key={p.path}
                to={p.path}
                viewTransition
                className={({ isActive }) =>
                  cn(
                    "focus-ring relative inline-flex h-9 items-center rounded-sm px-3 text-ui opacity-78 transition-opacity duration-(--dur-quick) ease-out hover:opacity-100",
                    isActive &&
                      "opacity-100 after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:bg-sky after:content-['']",
                    isActive && !scene && "text-sky-text",
                  )
                }
              >
                {p.label}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            onPointerEnter={() => void preloadPalette()}
            onFocus={() => void preloadPalette()}
            className={cn(
              "focus-ring hidden h-9 cursor-pointer items-center gap-2 rounded-sm border pr-2 pl-3 text-ui font-normal text-inherit transition-[border-color] duration-(--dur-quick) ease-out md:inline-flex",
              scene || mode === "bar" ? "border-mist-line bg-mist hover:border-mist-strong" : "border-line bg-surface-raised hover:border-line-strong",
            )}
          >
            <Search aria-hidden className="size-4" />
            <span className="min-w-30 text-left opacity-75">搜索</span>
            <Kbd className={cn(scene && "border-mist-line bg-transparent text-on-scene-muted")}>{mod} K</Kbd>
          </button>
          <IconButton
            icon={Search}
            label="搜索"
            className={cn("md:hidden", scene && "text-on-scene hover:not-disabled:bg-mist")}
            onClick={() => setPaletteOpen(true)}
          />
          <ThemeButton scene={scene} />
          {nav.length ? <MobileMenu scene={scene} /> : null}
        </div>
      </div>
    </header>
  );
}
