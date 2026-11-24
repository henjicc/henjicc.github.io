import type { LucideIcon } from "lucide-react";
import type { ComponentType, LazyExoticComponent } from "react";

export type ToolStatus = "live" | "plan";

export interface ToolMeta {
  /** 地址段 /tools/<id>/，同时是存储命名空间和共享元素过渡名 tool-<id>-icon / tool-<id>-name。发布后不要改。 */
  id: string;
  name: string;
  /** 卡片上的一句话介绍。 */
  summary: string;
  icon: LucideIcon;
  /** plan：只在列表里显示“计划中”，没有页面。 */
  status: ToolStatus;
  /** 命令面板的额外匹配词：拼音首字母、英文名、同义词。 */
  keywords: readonly string[];
  /** 能否打进 B 站 TOY 包（工具箱合集或单独一个 TOY）。 */
  toy: boolean;
}

export type ToolLoader = () => Promise<{ default: ComponentType }>;

export interface ToolEntry extends ToolMeta {
  load?: ToolLoader;
  /** 由 defineTool 用 React.lazy 包好的界面。 */
  Component?: LazyExoticComponent<ComponentType>;
}
