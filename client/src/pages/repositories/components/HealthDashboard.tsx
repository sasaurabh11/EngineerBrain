import { AlertTriangle, ChevronDown, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GoToProfileAction } from "@/components/go-to-profile-action";
import { InfoTooltip } from "@/components/info-tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { downloadBlob, analysisApi } from "../../../api/analysis.api";
import {
  useAnalysisStatus,
  useAnalysisTrend,
  useCancelAnalysis,
  useFindings,
  useLatestAnalysis,
  useRetryAnalysis,
  useTriggerAnalysis,
} from "../../../hooks/useAnalysis";
import type { Finding, FindingCategory, FindingSeverity, RepositoryAnalysis } from "../../../types/analysis.types";
import { DependencyCycleGraph } from "./DependencyCycleGraph";
import { TrendChart } from "./TrendChart";

const SCORE_LABELS = [
  {
    key: "overallScore",
    label: "Overall",
    hint: "A weighted average of every score below - the single number to watch for this repository's overall engineering health.",
  },
  {
    key: "architectureScore",
    label: "Architecture",
    hint: "Reflects how cleanly the codebase is structured: layering, design-pattern usage, and absence of architectural anti-patterns like circular dependencies.",
  },
  {
    key: "securityScore",
    label: "Security",
    hint: "Lower when the analysis finds SECURITY-category findings - secrets, injection risks, unsafe dependencies - weighted by severity.",
  },
  {
    key: "performanceScore",
    label: "Performance",
    hint: "Reflects PERFORMANCE-category findings - hot paths, inefficient patterns, and complexity that's likely to cause runtime slowness.",
  },
  {
    key: "maintainabilityScore",
    label: "Maintainability",
    hint: "How easy this codebase is to safely change - combines documentation, complexity, and technical debt into one measure.",
  },
  {
    key: "scalabilityScore",
    label: "Scalability",
    hint: "Whether the architecture can handle growth in load or codebase size without major rework - penalizes tight coupling and monolithic hot spots.",
  },
  {
    key: "modularityScore",
    label: "Modularity",
    hint: "How well-separated concerns are across modules/files - high coupling and god-modules lower this score.",
  },
  {
    key: "layeringScore",
    label: "Layering",
    hint: "Whether dependencies flow in one direction through the intended layers (e.g. UI → service → data) without upward or circular violations.",
  },
  {
    key: "documentationScore",
    label: "Documentation",
    hint: "Coverage and quality of comments, docstrings, and READMEs relative to the codebase's complexity.",
  },
  {
    key: "complexityScore",
    label: "Complexity",
    hint: "Based on cyclomatic complexity and function/file size - lower scores mean more oversized, hard-to-follow code.",
  },
  {
    key: "technicalDebtScore",
    label: "Technical Debt",
    hint: "Estimates the accumulated cost of shortcuts and unresolved findings still open in the codebase - lower means more debt to pay down.",
  },
] as const;

const SEVERITY_TONE: Record<FindingSeverity, StatusTone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "neutral",
};

const CATEGORIES: FindingCategory[] = ["QUALITY", "SECURITY", "PERFORMANCE", "DEPENDENCY", "SOLID", "PATTERN"];
const SEVERITIES: FindingSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function scoreToneClass(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function ScoreCard({ label, score, hint }: { label: string; score: number | null; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className={cn("text-3xl font-semibold tabular-nums", scoreToneClass(score))}>{score ?? "—"}</p>
      <div className="mt-1 flex items-center justify-center gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <InfoTooltip>{hint}</InfoTooltip>
      </div>
    </div>
  );
}

const DIMENSION_LABELS = SCORE_LABELS.filter((s) => s.key !== "overallScore");

/** Deterministic (not fabricated) rollup computed from the same analysis +
 * findings data already on screen - answers "what should I look at first"
 * without inventing a narrative the LLM never actually generated. */
function HealthSummaryBanner({ analysis, findings }: { analysis: RepositoryAnalysis; findings: Finding[] }) {
  const criticalCount = findings.filter((f) => f.severity === "CRITICAL").length;
  const highCount = findings.filter((f) => f.severity === "HIGH").length;

  const weakest = [...DIMENSION_LABELS]
    .map((d) => ({ ...d, score: analysis[d.key] }))
    .filter((d): d is (typeof DIMENSION_LABELS)[number] & { score: number } => d.score !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  let tone: StatusTone = "success";
  let headline = "No critical issues found";
  if (criticalCount > 0) {
    tone = "danger";
    headline = `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"} need attention`;
  } else if (highCount > 0) {
    tone = "warning";
    headline = `${highCount} high-severity issue${highCount === 1 ? "" : "s"} to review`;
  } else if (analysis.overallScore !== null && analysis.overallScore < 60) {
    tone = "warning";
    headline = "Overall score is below a healthy threshold";
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge tone={tone}>{headline}</StatusBadge>
        </div>
        {weakest.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Lowest-scoring dimensions:{" "}
            {weakest.map((d, i) => (
              <span key={d.key}>
                <span className="font-medium text-foreground">{d.label}</span> ({d.score}
                ){i < weakest.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const isCycle = finding.type === "CIRCULAR_DEPENDENCY" && Array.isArray(finding.metadata?.cycle);

  return (
    <li className="p-4">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={SEVERITY_TONE[finding.severity]}>{finding.severity.toLowerCase()}</StatusBadge>
            {finding.priority && finding.priority !== finding.severity && (
              <span className="text-xs text-muted-foreground">priority {finding.priority.toLowerCase()}</span>
            )}
            <Badge variant="outline">{finding.category}</Badge>
            <span className="text-xs text-muted-foreground">confidence {finding.confidence}%</span>
          </div>
          <p className="text-sm font-medium text-foreground">{finding.title}</p>
          {finding.filePath && (
            <p className="font-mono text-xs text-muted-foreground">
              {finding.filePath}
              {finding.startLine ? `:${finding.startLine}` : ""}
            </p>
          )}
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <p>{finding.explanation}</p>
          {finding.evidence && (
            <p>
              <span className="font-medium text-foreground">Evidence: </span>
              {finding.evidence}
            </p>
          )}
          {finding.suggestedFix && (
            <p>
              <span className="font-medium text-foreground">Suggested fix: </span>
              {finding.suggestedFix}
            </p>
          )}
          {finding.estimatedImpact && (
            <p>
              <span className="font-medium text-foreground">Estimated impact: </span>
              {finding.estimatedImpact}
            </p>
          )}
          {finding.relatedFiles.length > 1 && (
            <p>
              <span className="font-medium text-foreground">Related files: </span>
              {finding.relatedFiles.join(", ")}
            </p>
          )}
          {(finding.relatedClasses.length > 0 || finding.relatedFunctions.length > 0) && (
            <p>
              <span className="font-medium text-foreground">Related symbols: </span>
              {[...finding.relatedClasses, ...finding.relatedFunctions].join(", ")}
            </p>
          )}
          {isCycle && <DependencyCycleGraph cycle={finding.metadata!.cycle as string[]} />}
        </div>
      )}
    </li>
  );
}

function DetectedPatterns({ patterns }: { patterns: Finding[] }) {
  if (patterns.length === 0) return null;

  const byType = new Map<string, Finding[]>();
  for (const p of patterns) {
    const list = byType.get(p.type) ?? [];
    list.push(p);
    byType.set(p.type, list);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Detected design patterns</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {[...byType.entries()].map(([type, instances]) => (
          <div key={type} className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium text-foreground">
              {type} <span className="font-normal text-muted-foreground">({instances.length})</span>
            </p>
            <ul className="mt-1 space-y-1">
              {instances.slice(0, 5).map((i) => (
                <li key={i.id} className="font-mono text-xs text-muted-foreground">
                  {i.filePath} · confidence {i.confidence}%
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function HealthDashboard({ orgSlug, repositoryId }: { orgSlug: string; repositoryId: string }) {
  const { data: status } = useAnalysisStatus(orgSlug, repositoryId);
  const isComplete = status?.status === "COMPLETED";
  const { data: analysis } = useLatestAnalysis(orgSlug, repositoryId, isComplete);
  const [category, setCategory] = useState<FindingCategory | "">("");
  const [severity, setSeverity] = useState<FindingSeverity | "">("");
  const { data: findingsPage } = useFindings(orgSlug, repositoryId, isComplete, {
    category: category || undefined,
    severity: severity || undefined,
    pageSize: 100,
  });
  const { data: patternsPage } = useFindings(orgSlug, repositoryId, isComplete, { category: "PATTERN", pageSize: 100 });
  // Unfiltered, used only to compute the health summary banner below - independent of the category/severity filters above.
  const { data: allFindingsPage } = useFindings(orgSlug, repositoryId, isComplete, { pageSize: 200 });
  const { data: trend } = useAnalysisTrend(orgSlug, repositoryId, isComplete, 20);
  const triggerAnalysis = useTriggerAnalysis(orgSlug, repositoryId);
  const retryAnalysis = useRetryAnalysis(orgSlug, repositoryId);
  const cancelAnalysis = useCancelAnalysis(orgSlug, repositoryId);
  const [reportError, setReportError] = useState<string | null>(null);

  async function handleDownloadJson() {
    setReportError(null);
    try {
      const report = await analysisApi.reportJson(orgSlug, repositoryId);
      downloadBlob(JSON.stringify(report, null, 2), "analysis-report.json", "application/json");
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to download JSON report");
    }
  }

  async function handleDownloadMarkdown() {
    setReportError(null);
    try {
      const markdown = await analysisApi.reportMarkdown(orgSlug, repositoryId);
      downloadBlob(markdown, "analysis-report.md", "text/markdown");
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Failed to download Markdown report");
    }
  }

  if (!status || status.status === "PENDING") {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No health analysis yet"
        description="Run a full architecture, security, and quality analysis for this repository."
        action={
          <Button type="button" onClick={() => triggerAnalysis.mutate()} disabled={triggerAnalysis.isPending}>
            {triggerAnalysis.isPending && <Loader2 className="animate-spin" />}
            Run analysis
          </Button>
        }
      />
    );
  }

  if (status.status === "RUNNING") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-10 text-center">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing repository…</p>
        <Button type="button" variant="outline" size="sm" onClick={() => cancelAnalysis.mutate(status.id)} disabled={cancelAnalysis.isPending}>
          Cancel analysis
        </Button>
      </div>
    );
  }

  if (status.status === "CANCELLED") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Analysis cancelled"
        description="The last analysis run was cancelled before it finished."
        action={
          <Button type="button" onClick={() => triggerAnalysis.mutate()} disabled={triggerAnalysis.isPending}>
            Run analysis
          </Button>
        }
      />
    );
  }

  if (status.status === "FAILED") {
    return (
      <ErrorState
        title="Analysis failed"
        message={status.errorMessage ?? "The analysis run did not complete."}
        onRetry={() => retryAnalysis.mutate(status.id)}
        action={<GoToProfileAction code={status.errorCode} />}
      />
    );
  }

  const patterns = patternsPage?.items ?? [];
  const findings = findingsPage?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {analysis?.completedAt && `Last analyzed ${new Date(analysis.completedAt).toLocaleString()}`}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadJson}>
            <Download /> JSON
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownloadMarkdown}>
            <Download /> Markdown
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => triggerAnalysis.mutate()} disabled={triggerAnalysis.isPending}>
            <RefreshCw className={cn(triggerAnalysis.isPending && "animate-spin")} /> Re-run analysis
          </Button>
        </div>
      </div>
      {reportError && <p className="text-sm text-destructive">{reportError}</p>}

      {analysis && <HealthSummaryBanner analysis={analysis} findings={allFindingsPage?.items ?? []} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {SCORE_LABELS.map(({ key, label, hint }) => (
          <ScoreCard key={key} label={label} hint={hint} score={analysis ? (analysis[key] as number | null) : null} />
        ))}
      </div>

      {analysis?.architectureSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Architecture summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{analysis.architectureSummary}</p>
          </CardContent>
        </Card>
      )}

      {trend && trend.length > 1 && (
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Score trend</p>
          <TrendChart history={trend} />
        </div>
      )}

      <DetectedPatterns patterns={patterns} />

      <div className="flex flex-wrap gap-2">
        <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : (v as FindingCategory))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity || "all"} onValueChange={(v) => setSeverity(v === "all" ? "" : (v as FindingSeverity))}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <ul className="divide-y divide-border">
          {findings.length === 0 && (
            <li className="p-6">
              <EmptyState icon={ShieldCheck} title="No findings" description="No findings match these filters." />
            </li>
          )}
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </ul>
      </Card>
      {findingsPage && findingsPage.pageInfo.totalCount > findings.length && (
        <p className="text-xs text-muted-foreground">
          Showing {findings.length} of {findingsPage.pageInfo.totalCount} findings.
        </p>
      )}
    </div>
  );
}
