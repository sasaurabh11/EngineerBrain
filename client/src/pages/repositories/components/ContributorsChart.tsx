import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Contributor } from "../../../types/repository.types";

/** Contribution-share bar chart for the top contributors - computed from the
 * same list already rendered below it, not a new query. */
export function ContributorsChart({ contributors }: { contributors: Contributor[] }) {
  if (contributors.length < 2) return null;

  const data = [...contributors]
    .sort((a, b) => b.contributions - a.contributions)
    .slice(0, 8)
    .map((c) => ({ login: c.githubLogin, Contributions: c.contributions }));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Contribution share (top {data.length})</p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis
            type="category"
            dataKey="login"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={90}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar dataKey="Contributions" fill="var(--chart-3)" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
