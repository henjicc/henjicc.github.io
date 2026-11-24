import { Check, Maximize, Minimize, RotateCcw } from "lucide-react";
import { Button } from "~/ui/button";
import { IconButton } from "~/ui/icon-button";
import { Kbd } from "~/ui/kbd";
import { cn } from "~/ui/lib/utils";
import { useHydrated } from "../media";
import type { ToolLayoutProps } from "./ToolShell";

function hotkeyLabel(hotkey: ToolLayoutProps["primary"]["hotkey"], mac: boolean) {
  if (hotkey === "space") return "Space";
  return mac ? "⌘ Enter" : "Ctrl Enter";
}

// 桌面：左侧 320px 控制栏（surface），右侧舞台（surface-sunken），舞台下方一条操作栏放主按钮。
export function DesktopToolLayout({ setRoot, ...p }: ToolLayoutProps) {
  const hydrated = useHydrated();
  const mac = hydrated && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const ready = p.ready !== false;
  const PrimaryIcon = p.primary.icon;
  return (
    <div
      ref={setRoot}
      data-immersive={p.fullscreen || undefined}
      className="grid h-[calc(100dvh-64px)] min-h-[560px] grid-cols-[280px_minmax(0,1fr)] bg-ground text-ink data-immersive:h-dvh data-immersive:grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <aside
        aria-label="设置"
        className={cn("flex min-h-0 flex-col gap-6 overflow-auto border-r border-line bg-surface p-6 in-data-immersive:hidden", !ready && "invisible")}
      >
        {p.controls}
        {p.onReset ? (
          <div className="mt-auto border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={p.onReset}>
              <RotateCcw aria-hidden />
              恢复默认
            </Button>
          </div>
        ) : null}
      </aside>
      <section aria-label={p.tool.name} className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
        <h1 className="sr-only">{p.tool.name}</h1>
        <div
          data-over={p.dragOver ?? false}
          className="vf grid min-h-0 place-items-center overflow-hidden bg-surface-sunken p-10 [--vf-inset:20px]"
        >
          {ready ? p.stage : null}
        </div>
        <div className="flex min-h-16 items-center gap-4 border-t border-line bg-surface px-6">
          <div className="flex min-w-0 items-center gap-3 font-num text-timecode text-ink-muted tabular-nums">
            {ready ? p.status : null}
            <Kbd>{hotkeyLabel(p.primary.hotkey, mac)}</Kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {ready ? p.actions : null}
            {p.immersive ? (
              <IconButton icon={p.fullscreen ? Minimize : Maximize} label={p.fullscreen ? "退出全屏" : "全屏"} onClick={p.toggleFullscreen} />
            ) : null}
            <Button
              variant="primary"
              size="lg"
              disabled={!ready || p.primary.disabled}
              onClick={p.primary.onClick}
            >
              {p.primary.done ? <Check aria-hidden /> : PrimaryIcon ? <PrimaryIcon aria-hidden /> : null}
              {p.primary.label}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
