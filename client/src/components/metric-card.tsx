import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { InfoTooltip } from "@/components/info-tooltip";
import { cn } from "@/lib/utils";

export type MetricTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_TEXT: Record<MetricTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
  neutral: "text-foreground",
};

const TONE_ICON_BG: Record<MetricTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/10 text-info",
  neutral: "bg-muted text-muted-foreground",
};

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: MetricTone;
  /** Explanation shown via an (i) affordance next to the label - use for anything not self-evident. */
  hint?: React.ReactNode;
  /** Signed percentage or count change since the prior period. */
  trend?: { value: number; suffix?: string };
  className?: string;
}

/** The shared KPI tile used for dashboard/org-level rollups - one place to
 * keep number+label+trend visually consistent instead of redefining ad hoc
 * "ScoreCard"-style tiles per page. */
export function MetricCard({ label, value, icon: Icon, tone = "neutral", hint, trend, className }: MetricCardProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-4", className)}>
      <div className="min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
          {hint && <InfoTooltip>{hint}</InfoTooltip>}
        </div>
        <p className={cn("text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</p>
        {trend && (
          <p className={cn("flex items-center gap-1 text-xs tabular-nums", trend.value >= 0 ? "text-success" : "text-destructive")}>
            {trend.value >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend.value >= 0 ? "+" : ""}
            {trend.value}
            {trend.suffix ?? ""}
          </p>
        )}
      </div>
      {Icon && (
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", TONE_ICON_BG[tone])}>
          <Icon className="size-4" />
        </div>
      )}
    </div>
  );
}
