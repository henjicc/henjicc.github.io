import { NotFoundPage } from "~/pages/NotFoundPage";
import { ToolPage } from "~/pages/ToolPage";
import { toolIdFromParams, type ShellHandle } from "~/shell/handle";
import { pageMeta } from "~/shell/meta";
import { getLiveTool } from "~/tools/lookup";
import type { Route } from "./+types/tool";

export const meta = ({ params }: Route.MetaArgs) => {
  const tool = getLiveTool(toolIdFromParams(params));
  return tool ? pageMeta({ title: tool.name, description: tool.summary }) : pageMeta({ title: "找不到这个页面" });
};
export const handle: ShellHandle = { tool: true };

export default function Tool({ params }: Route.ComponentProps) {
  const tool = getLiveTool(toolIdFromParams(params));
  return tool ? <ToolPage tool={tool} /> : <NotFoundPage />;
}
