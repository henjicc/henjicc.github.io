import { tools } from "./registry";
import type { ToolEntry } from "./types";

export const liveTools: ToolEntry[] = tools.filter((t) => t.status === "live");

export function getLiveTool(id: string | undefined): ToolEntry | undefined {
  return liveTools.find((t) => t.id === id);
}

export function toolPath(id: string): string {
  return `/tools/${id}/`;
}
