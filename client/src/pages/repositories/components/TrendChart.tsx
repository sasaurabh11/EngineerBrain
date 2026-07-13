import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RepositoryAnalysis } from "../../../types/analysis.types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TrendChart({ history }: { history: RepositoryAnalysis[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-muted-foreground">Not enough analysis history yet to show a trend.</p>;
  }

  const data = history.map((h) => ({
    date: formatDate(h.startedAt),
    Overall: h.overallScore,
    Security: h.securityScore,
    Maintainability: h.maintainabilityScore,
  }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Line type="monotone" dataKey="Overall" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Security" stroke="var(--chart-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          <Line type="monotone" dataKey="Maintainability" stroke="var(--chart-3)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-[var(--chart-1)]" /> Overall
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-[var(--chart-2)]" /> Security
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-[var(--chart-3)]" /> Maintainability
        </span>
      </div>
    </div>
  );
}
