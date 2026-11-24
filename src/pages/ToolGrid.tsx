import { MessageCircle } from "lucide-react";
import { biliSpace } from "~/content/site";
import { externalLinkProps } from "~/shell/links";
import { isToy } from "~/shell/env";
import { tools } from "~/tools/registry";
import { toolPath } from "~/tools/lookup";
import { cn } from "~/ui/lib/utils";
import { ToolCard } from "~/ui/tool-card";

/**
 * 工具卡片网格，数据来自登记表。第一张（最常用的）跨两列；最后是一条不抢眼的“想要别的工具？”，占满一行。
 * 手机上也是两列（设计稿手机版首页），第一张占满一行。
 */
export function ToolGrid({ className }: { className?: string }) {
  const wish = externalLinkProps(biliSpace);
  // 两列时第一张之后剩奇数张，最后一张会单独占半行（TOY 合集只有两个工具），这时也让它占满
  const lonely = (tools.length - 1) % 2 === 1;
  return (
    <div className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4", className)}>
      {tools.map((t, i) => (
        <ToolCard
          key={t.id}
          id={t.id}
          name={t.name}
          summary={t.summary}
          icon={t.icon}
          status={t.status}
          to={t.status === "live" ? (isToy ? `/tools/${t.id}` : toolPath(t.id)) : undefined}
          className={i === 0 ? "col-span-2" : lonely && i === tools.length - 1 ? "col-span-2 lg:col-span-1" : undefined}
        />
      ))}
      <ToolCard
        id="wish"
        quiet
        name="想要别的工具？"
        summary="去 B 站私信告诉我。"
        icon={MessageCircle}
        href={wish.href}
        onClick={wish.onClick}
        className="col-span-full"
      />
    </div>
  );
}
