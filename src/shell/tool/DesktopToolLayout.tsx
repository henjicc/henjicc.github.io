import { Check, Maximize, Minimize, RotateCcw } from "lucide-react";
import { Button } from "~/ui/button";
import { IconButton } from "~/ui/icon-button";
import { Kbd } from "~/ui/kbd";
import { cn } from "~/ui/lib/utils";
import { useHydrated } from "../media";
import { ActionSlot } from "./ActionSlot";
import { privacyNote, type ToolLayoutProps } from "./ToolShell";

function hotkeyLabel(hotkey: ToolLayoutProps["primary"]["hotkey"], mac: boolean) {
  if (hotkey === "space") return "Space";
  return mac ? "⌘ Enter" : "Ctrl Enter";
}

// 桌面：左侧 320px 控制栏（surface），右侧舞台（surface-sunken），舞台下方一条操作栏放主按钮。
export function DesktopToolLayout({ setStage, ...p }: ToolLayoutProps) {
  const hydrated = useHydrated();
  const mac = hydrated && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const ready = p.ready !== false;
  const PrimaryIcon = p.primary.icon;
  return (
    <div
      data-immersive={p.fullscreen || undefined}
      className="grid h-[calc(100dvh-64px)] min-h-[560px] grid-cols-[280px_minmax(0,1fr)] bg-ground text-ink data-immersive:h-dvh data-immersive:grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <aside
        aria-label="设置"
        className={cn("flex min-h-0 flex-col gap-6 overflow-auto border-r border-line bg-surface p-6 in-data-immersive:hidden", !ready && "invisible")}
      >
        {p.controls}
        <div className="mt-auto grid justify-items-start gap-3 border-t border-line pt-4">
          {p.onReset ? (
            <Button variant="ghost" size="sm" onClick={p.onReset}>
              <RotateCcw aria-hidden />
              恢复默认
            </Button>
          ) : null}
          <p className="m-0 text-caption text-ink-muted">{privacyNote(p.tool)}</p>
        </div>
      </aside>
      <section aria-label={p.tool.name} className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
        <h1 className="sr-only">{p.tool.name}</h1>
        <div
          ref={setStage}
          tabIndex={-1}
          data-over={p.dragOver ?? false}
          className="vf grid min-h-0 outline-none place-items-center overflow-hidden bg-surface-sunken p-10 [--vf-inset:20px]"
        >
          {ready ? p.stage : null}
        </div>
        <div className="flex min-h-16 items-center gap-4 border-t border-line bg-surface px-6">
          {/* 全屏放在操作栏最左边的固定位置，不夹在工具自己的按钮中间 */}
          {p.immersive ? (
            <IconButton
              icon={p.fullscreen ? Minimize : Maximize}
              label={p.fullscreen ? "退出全屏" : "全屏"}
              onClick={p.toggleFullscreen}
              className="-ml-2"
            />
          ) : null}
          <div className="flex min-w-0 items-center gap-3 font-num text-timecode text-ink-muted tabular-nums">
            {ready ? p.status : null}
            <Kbd>{hotkeyLabel(p.primary.hotkey, mac)}</Kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ActionSlot>{ready ? p.actions : null}</ActionSlot>
            {/* 固定最小宽度：“开始抽取”变“停下”、“导出图片”变进度时按钮不变窄，旁边的按钮也不挪 */}
            <Button
              variant="primary"
              size="lg"
              className="min-w-38"
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
