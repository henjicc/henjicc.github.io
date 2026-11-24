import { ArrowUpRight, type LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "~/ui/lib/utils";
import { Tag } from "~/ui/tag";
import { toolTransition } from "~/ui/vt";

type ToolCardProps = {
  id: string;
  name: string;
  summary: string;
  icon: LucideIcon;
  status?: "live" | "plan";
  /** 站内地址，走路由和共享元素过渡。 */
  to?: string;
  /** 站外地址（如“想要别的工具？”去 B 站私信）。 */
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** 宽卡片右侧的动态小样。 */
  glyph?: ReactNode;
  className?: string;
};

const cardBase =
  "group relative grid min-h-49 gap-5 rounded-lg border border-line bg-surface p-5 text-ink transition-[translate,border-color,box-shadow,background-color] duration-(--dur-quick) ease-out";

export function iconBlock(plan: boolean, size: "md" | "sm" = "md") {
  return cn(
    "grid place-items-center",
    size === "md" ? "size-11 rounded-md [&_svg]:size-[22px]" : "size-7 rounded-sm [&_svg]:size-4",
    plan ? "bg-surface-raised text-ink-muted" : "bg-sky-soft text-sky-text",
  );
}

function ToolCard({ id, name, summary, icon: Icon, status = "live", to, href, onClick, glyph, className }: ToolCardProps) {
  const plan = status === "plan";
  const body = (
    <>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between">
          <span className={iconBlock(plan)} {...(plan ? {} : toolTransition(id, "icon"))}>
            <Icon aria-hidden />
          </span>
          {plan ? (
            <Tag tone="amber">计划中</Tag>
          ) : (
            <ArrowUpRight
              aria-hidden
              className="size-[18px] text-ink-faint transition-[color,translate] duration-(--dur-quick) ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-sky-text"
            />
          )}
        </div>
        <h3 className="mt-5 mb-1 text-title-3">
          <span {...(plan ? {} : toolTransition(id, "name"))}>{name}</span>
        </h3>
        <p className="m-0 text-ui font-normal leading-[1.6] text-ink-muted">{summary}</p>
      </div>
      {glyph ? <div className="relative min-h-[150px] overflow-hidden rounded-md bg-surface-sunken">{glyph}</div> : null}
    </>
  );
  const interactive = cn(
    cardBase,
    glyph && "grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-stretch",
    "focus-ring hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift active:translate-y-0 active:scale-99",
    className,
  );
  if (plan) return <div className={cn(cardBase, "bg-transparent", className)}>{body}</div>;
  if (to)
    return (
      <Link to={to} viewTransition onClick={onClick} className={interactive}>
        {body}
      </Link>
    );
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={onClick} className={interactive}>
      {body}
    </a>
  );
}

export { ToolCard };
