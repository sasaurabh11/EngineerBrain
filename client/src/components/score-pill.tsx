import { cn } from "@/lib/utils";

function scoreToneClass(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function ScorePill({ score, label, size = "md" }: { score: number | null; label?: string; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "font-semibold tabular-nums",
          size === "sm" ? "text-sm" : "text-lg",
          score === null ? "text-muted-foreground" : scoreToneClass(score),
        )}
      >
        {score ?? "—"}
      </span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
