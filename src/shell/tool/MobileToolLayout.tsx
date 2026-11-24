import { Check, ChevronLeft, Maximize, Minimize, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button } from "~/ui/button";
import { IconButton } from "~/ui/icon-button";
import { cn } from "~/ui/lib/utils";
import { iconBlock } from "~/ui/tool-card";
import { toolTransition } from "~/ui/vt";
import { toolsHome } from "../env";
import { BottomSheet, SHEET_PEEK } from "./BottomSheet";
import type { ToolLayoutProps } from "./ToolShell";

// 手机（第 0 阶段在 B 站 App 里验证过的那一版）：顶栏（返回、工具名、全屏）→ 舞台占满中间 → 底部抽屉 → 主按钮固定在最底下。
// TOY 里侧滑返回会直接退出整个 TOY，所以页面只有“列表 → 工具”一层，返回按钮走页面内的历史。
export function MobileToolLayout({ setRoot, ...p }: ToolLayoutProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const ready = p.ready !== false;
  const PrimaryIcon = p.primary.icon;

  function back() {
    // 直接打开的工具页没有站内历史，返回就去工具列表
    if (location.key !== "default") void navigate(-1);
    else if (toolsHome) void navigate(toolsHome, { viewTransition: true });
  }

  return (
    <div ref={setRoot} className="fixed inset-0 z-40 grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-ground text-ink">
      <header className="flex h-[calc(52px+env(safe-area-inset-top))] items-center gap-2.5 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)]">
        {toolsHome ? <IconButton icon={ChevronLeft} label="返回" onClick={back} className="size-11 [&_svg]:size-5" /> : <span className="w-2" />}
        <span className={iconBlock(false, "sm")} {...toolTransition(p.tool.id, "icon")}>
          <p.tool.icon aria-hidden />
        </span>
        <h1 className="m-0 text-[16px] leading-none font-bold">
          <span {...toolTransition(p.tool.id, "name")}>{p.tool.name}</span>
        </h1>
        {p.immersive ? (
          <IconButton
            icon={p.fullscreen ? Minimize : Maximize}
            label={p.fullscreen ? "退出全屏" : "全屏"}
            onClick={p.toggleFullscreen}
            className="ml-auto size-11 [&_svg]:size-5"
          />
        ) : null}
      </header>

      <div className="relative min-h-0 bg-surface-sunken">
        <section
          aria-label={p.tool.name}
          data-over={p.dragOver ?? false}
          onClick={() => sheetOpen && setSheetOpen(false)}
          style={{ bottom: p.fullscreen ? 0 : SHEET_PEEK }}
          className="vf absolute inset-x-0 top-0 grid place-items-center overflow-hidden p-6 [--vf-corner:24px] [--vf-inset:14px]"
        >
          {ready ? p.stage : null}
        </section>
        {p.fullscreen ? null : (
          <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen} summary={ready ? p.summary : null}>
            <div className={cn("grid content-start gap-6", !ready && "invisible")}>{p.controls}</div>
            {p.onReset ? (
              <div className="border-t border-line pt-4">
                <Button variant="ghost" size="sm" onClick={p.onReset}>
                  <RotateCcw aria-hidden />
                  恢复默认
                </Button>
              </div>
            ) : null}
          </BottomSheet>
        )}
      </div>

      <footer className="relative z-3 flex items-center gap-2 border-t border-line bg-surface px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
        {ready ? p.actions : null}
        <Button
          variant="primary"
          size="lg"
          className="h-13 flex-1 text-[16px]"
          disabled={!ready || p.primary.disabled}
          onClick={() => {
            // 开始操作时收起抽屉，把舞台让出来
            setSheetOpen(false);
            p.primary.onClick();
          }}
        >
          {p.primary.done ? <Check aria-hidden /> : PrimaryIcon ? <PrimaryIcon aria-hidden /> : null}
          {p.primary.label}
        </Button>
      </footer>
    </div>
  );
}
