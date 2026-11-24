import { MessageCircle } from "lucide-react";
import { biliSpace } from "~/content/site";
import { externalLinkProps } from "~/shell/links";
import { isToy } from "~/shell/env";
import { tools } from "~/tools/registry";
import { toolPath } from "~/tools/lookup";
import { cn } from "~/ui/lib/utils";
import { ToolCard } from "~/ui/tool-card";

/** 工具卡片网格，数据来自登记表。最后一格是“想要别的工具？”。 */
export function ToolGrid({ className }: { className?: string }) {
  const wish = externalLinkProps(biliSpace);
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4", className)}>
      {tools.map((t) => (
        <ToolCard
          key={t.id}
          id={t.id}
          name={t.name}
          summary={t.summary}
          icon={t.icon}
          status={t.status}
          to={t.status === "live" ? (isToy ? `/tools/${t.id}` : toolPath(t.id)) : undefined}
        />
      ))}
      <ToolCard id="wish" name="想要别的工具？" summary="去 B 站私信告诉我。" icon={MessageCircle} status="live" href={wish.href} onClick={wish.onClick} />
    </div>
  );
}
