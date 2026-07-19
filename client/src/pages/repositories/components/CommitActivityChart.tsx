import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Commit } from "../../../types/repository.types";

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Buckets the already-fetched commit list by day - no extra endpoint needed,
 * the data to chart this was already on screen as a flat list. */
export function CommitActivityChart({ commits }: { commits: Commit[] }) {
  if (commits.length < 2) return null;

  const counts = new Map<string, number>();
  for (const commit of commits) {
    const key = dayKey(commit.committedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const data = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      Commits: count,
    }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Commit activity ({data.length}-day window)</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={28} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar dataKey="Commits" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
