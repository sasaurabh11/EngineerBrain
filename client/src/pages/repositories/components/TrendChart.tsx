import type { RepositoryAnalysis } from "../../../types/analysis.types";

const WIDTH = 480;
const HEIGHT = 120;
const PADDING = 8;

function toPoints(values: (number | null)[]): string {
  const known = values.filter((v): v is number => v !== null);
  if (known.length === 0) return "";

  const step = values.length > 1 ? (WIDTH - PADDING * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      if (v === null) return null;
      const x = PADDING + step * i;
      const y = HEIGHT - PADDING - (v / 100) * (HEIGHT - PADDING * 2);
      return `${x},${y}`;
    })
    .filter((p): p is string => p !== null)
    .join(" ");
}

export function TrendChart({ history }: { history: RepositoryAnalysis[] }) {
  if (history.length < 2) {
    return <p className="text-sm text-gray-500">Not enough analysis history yet to show a trend.</p>;
  }

  const overall = history.map((h) => h.overallScore);
  const security = history.map((h) => h.securityScore);
  const maintainability = history.map((h) => h.maintainabilityScore);

  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" preserveAspectRatio="none">
        <polyline points={toPoints(overall)} fill="none" stroke="#111827" strokeWidth="2" />
        <polyline points={toPoints(security)} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 3" />
        <polyline points={toPoints(maintainability)} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-gray-900" /> Overall
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-red-600" /> Security
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 bg-blue-600" /> Maintainability
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {new Date(history[0]!.startedAt).toLocaleDateString()} → {new Date(history[history.length - 1]!.startedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
