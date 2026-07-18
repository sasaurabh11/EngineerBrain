import { Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const SCORES = [
  { label: "Architecture", value: 78 },
  { label: "Security", value: 64 },
  { label: "Performance", value: 82 },
  { label: "Maintainability", value: 71 },
  { label: "Technical debt", value: 58 },
];

function scoreClass(value: number): string {
  if (value >= 75) return "text-success";
  if (value >= 60) return "text-warning";
  return "text-destructive";
}

export function ScoreSpecimen() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ul className="space-y-2.5 font-mono text-sm">
        {SCORES.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{s.label}</span>
            <span className={cn("tabular-nums font-semibold", scoreClass(s.value))}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatSpecimen() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 font-mono text-sm">
      <p className="text-muted-foreground">&gt; How does session expiry work?</p>
      <p className="leading-relaxed text-foreground">
        Sessions expire after 14 days of inactivity, checked in the auth middleware on every request.
      </p>
      <span className="inline-flex w-fit items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
        src/middleware/auth.ts:112
      </span>
    </div>
  );
}

const TRACE_STEPS = [
  { label: "get_pr_diff", status: "done" as const },
  { label: "ci_status", status: "done" as const },
  { label: "pr_dependency_impact", status: "done" as const },
  { label: "review_pr", status: "done" as const },
  { label: "post_review_comment", status: "waiting" as const },
];

export function TraceSpecimen() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ul className="space-y-2.5 font-mono text-sm">
        {TRACE_STEPS.map((step) => (
          <li key={step.label} className="flex items-center gap-2">
            {step.status === "done" ? (
              <Check className="size-3.5 shrink-0 text-success" />
            ) : (
              <Clock className="size-3.5 shrink-0 text-warning" />
            )}
            <span className={step.status === "waiting" ? "text-warning" : "text-foreground"}>{step.label}</span>
            {step.status === "waiting" && <span className="text-xs text-muted-foreground">awaiting approval</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
