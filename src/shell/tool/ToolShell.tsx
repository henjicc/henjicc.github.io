import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { platform } from "~/platform";
import type { ToolMeta } from "~/tools/types";
import { useIsMobile } from "../media";
import { DesktopToolLayout } from "./DesktopToolLayout";
import type { PrimaryHotkey } from "./hotkey";
import { usePrimaryHotkey } from "./hotkey";
import { MobileToolLayout } from "./MobileToolLayout";

export type PrimaryAction = {
  /** 动词开头，说清点了会发生什么：“开始抽取”“导出图片”。 */
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  /** 执行完的反馈：文字换成“已导出”并带勾，由调用方停 1.2 秒后换回。 */
  done?: boolean;
  /** 默认 Ctrl/⌘ Enter；随机抽取这类全屏用的工具用空格。 */
  hotkey?: PrimaryHotkey;
};

export type ToolShellProps = {
  tool: Pick<ToolMeta, "id" | "name" | "icon" | "local">;
  /** 控制栏：一组 <ControlGroup>。桌面在左侧 320px 的栏里，手机在底部抽屉里。 */
  controls: ReactNode;
  /** 手机抽屉收起时露出的一行摘要，如“名单 10 人 · 已抽 1 人”。 */
  summary: ReactNode;
  /** 舞台：工具的主画面。 */
  stage: ReactNode;
  /** 桌面操作栏左侧的状态（文件名、尺寸、数量），用 timecode 字号。 */
  status?: ReactNode;
  /** 主按钮左边的次要按钮。 */
  actions?: ReactNode;
  primary: PrimaryAction;
  /** 有它时控制栏底部出现“恢复默认”。 */
  onReset?: () => void;
  /** 文件拖到页面上时为 true：舞台的取景框四角向内收。 */
  dragOver?: boolean;
  /** 显示全屏按钮。桌面把整个工具切到浏览器全屏并收起控制栏；手机和 TOY 切沉浸模式。 */
  immersive?: boolean;
  onImmersiveChange?: (on: boolean) => void;
  /** 设置还没从存储里读出来时传 false，先不显示控件和舞台内容，免得默认值闪一下。 */
  ready?: boolean;
};

export type ToolLayoutProps = ToolShellProps & {
  fullscreen: boolean;
  toggleFullscreen: () => void;
  /** 舞台元素：切换全屏后焦点放回这里，空格才能接着控制主操作。 */
  setStage: (el: HTMLElement | null) => void;
};

/** 工具页脚的一句话：文件去哪了。每个工具只说一次，不在控件旁边反复说。 */
export function privacyNote(tool: Pick<ToolMeta, "local">): string {
  return tool.local === false ? "文件内容会发送到你配置的接口" : "处理都在你的浏览器里，文件不会上传";
}

/**
 * 工具外壳：每个工具都用它，只换控制栏和舞台里的东西。按视口宽度选桌面布局（控制栏 + 舞台 + 操作栏）
 * 或手机布局（顶栏 + 舞台 + 底部抽屉 + 固定主按钮）；TOY 在手机上自然走手机布局。
 */
export function ToolShell(props: ToolShellProps) {
  const mobile = useIsMobile();
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLElement | null>(null);
  const { onImmersiveChange, primary } = props;

  useEffect(
    () =>
      platform.onImmersiveChange((on) => {
        setFullscreen(on);
        onImmersiveChange?.(on);
      }),
    [onImmersiveChange],
  );

  const toggleFullscreen = useCallback(() => {
    const next = !fullscreen;
    // 整页（html）进入全屏，顶栏和控制栏用样式收起。只把工具根节点全屏的话，挂在 body 上的轻提示和弹窗
    // （Sonner、Radix 的 Portal）都在全屏元素外面，全屏时看不到。
    void platform.setImmersive(next, null).then((ok) => {
      if (!ok) return;
      setFullscreen(next);
      onImmersiveChange?.(next);
      // 焦点还在全屏按钮上的话，接着按空格会再切一次全屏，而不是控制工具
      stage.current?.focus({ preventScroll: true });
    });
  }, [fullscreen, onImmersiveChange]);

  // 离开工具页时退出全屏
  useEffect(
    () => () => {
      void platform.setImmersive(false);
    },
    [],
  );

  usePrimaryHotkey(primary.hotkey ?? "mod+enter", primary.onClick, props.ready !== false && !primary.disabled);

  const layout: ToolLayoutProps = {
    ...props,
    fullscreen,
    toggleFullscreen,
    setStage: (el) => {
      stage.current = el;
    },
  };
  return mobile ? <MobileToolLayout {...layout} /> : <DesktopToolLayout {...layout} />;
}
