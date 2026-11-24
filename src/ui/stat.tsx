import { cn } from "~/ui/lib/utils";

function Stat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div className={cn("grid gap-0.5", className)}>
      <span className="whitespace-nowrap font-num text-stat tabular-nums">{value}</span>
      <span className="text-caption text-ink-muted in-[.scene]:text-on-scene-muted">{label}</span>
    </div>
  );
}

export { Stat };
