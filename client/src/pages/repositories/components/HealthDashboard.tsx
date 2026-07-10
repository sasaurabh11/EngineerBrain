import { useState } from "react";
import { useAnalysisStatus, useFindings, useLatestAnalysis, useTriggerAnalysis } from "../../../hooks/useAnalysis";
import type { Finding, FindingCategory, FindingSeverity } from "../../../types/analysis.types";
import { DependencyCycleGraph } from "./DependencyCycleGraph";

const SCORE_LABELS = [
  { key: "overallScore", label: "Overall" },
  { key: "architectureScore", label: "Architecture" },
  { key: "securityScore", label: "Security" },
  { key: "performanceScore", label: "Performance" },
  { key: "maintainabilityScore", label: "Maintainability" },
] as const;

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700",
  HIGH: "bg-orange-100 text-orange-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-blue-100 text-blue-700",
  INFO: "bg-gray-100 text-gray-600",
};

const CATEGORIES: FindingCategory[] = ["QUALITY", "SECURITY", "PERFORMANCE", "DEPENDENCY", "SOLID", "PATTERN"];
const SEVERITIES: FindingSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function scoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4 text-center">
      <p className={`text-3xl font-semibold ${scoreColor(score)}`}>{score ?? "—"}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const isCycle = finding.type === "CIRCULAR_DEPENDENCY" && Array.isArray(finding.metadata?.cycle);

  return (
    <li className="p-3">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <div>
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_STYLES[finding.severity] ?? ""}`}>
              {finding.severity}
            </span>
            <span className="text-xs text-gray-400">{finding.category}</span>
            <span className="text-xs text-gray-400">· confidence {finding.confidence}%</span>
          </div>
          <p className="mt-1 text-sm text-gray-900">{finding.title}</p>
          {finding.filePath && (
            <p className="font-mono text-xs text-gray-500">
              {finding.filePath}
              {finding.startLine ? `:${finding.startLine}` : ""}
            </p>
          )}
        </div>
        <span className="text-xs text-gray-400">{expanded ? "Hide" : "Details"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 text-sm text-gray-700">
          <p>{finding.explanation}</p>
          {finding.suggestedFix && (
            <p className="text-gray-600">
              <span className="font-medium text-gray-900">Suggested fix: </span>
              {finding.suggestedFix}
            </p>
          )}
          {isCycle && <DependencyCycleGraph cycle={finding.metadata!.cycle as string[]} />}
        </div>
      )}
    </li>
  );
}

export function HealthDashboard({ orgSlug, repositoryId }: { orgSlug: string; repositoryId: string }) {
  const { data: status } = useAnalysisStatus(orgSlug, repositoryId);
  const isComplete = status?.status === "COMPLETED";
  const { data: analysis } = useLatestAnalysis(orgSlug, repositoryId, isComplete);
  const [category, setCategory] = useState<FindingCategory | "">("");
  const [severity, setSeverity] = useState<FindingSeverity | "">("");
  const { data: findings } = useFindings(orgSlug, repositoryId, isComplete, {
    category: category || undefined,
    severity: severity || undefined,
  });
  const triggerAnalysis = useTriggerAnalysis(orgSlug, repositoryId);

  if (!status || status.status === "PENDING") {
    return (
      <div className="flex flex-col items-center gap-3 rounded border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">No health analysis has run for this repository yet.</p>
        <button
          type="button"
          onClick={() => triggerAnalysis.mutate()}
          disabled={triggerAnalysis.isPending}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Run analysis
        </button>
      </div>
    );
  }

  if (status.status === "RUNNING") {
    return <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Analyzing repository...</div>;
  }

  if (status.status === "FAILED") {
    return (
      <div className="space-y-3 rounded border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <p>Analysis failed{status.errorMessage ? `: ${status.errorMessage}` : "."}</p>
        <button
          type="button"
          onClick={() => triggerAnalysis.mutate()}
          className="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {analysis?.completedAt && `Last analyzed ${new Date(analysis.completedAt).toLocaleString()}`}
        </p>
        <button
          type="button"
          onClick={() => triggerAnalysis.mutate()}
          disabled={triggerAnalysis.isPending}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Re-run analysis
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {SCORE_LABELS.map(({ key, label }) => (
          <ScoreCard key={key} label={label} score={analysis ? (analysis[key] as number | null) : null} />
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FindingCategory | "")}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as FindingSeverity | "")}
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
        {findings?.length === 0 && <li className="p-4 text-sm text-gray-500">No findings match these filters.</li>}
        {findings?.map((finding) => <FindingRow key={finding.id} finding={finding} />)}
      </ul>
    </div>
  );
}
