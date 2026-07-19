import { AlertTriangle, ChevronDown, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { GoToProfileAction } from "@/components/go-to-profile-action";
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
import type { Finding, FindingCategory, FindingSeverity } from "../../../types/analysis.types";
import { DependencyCycleGraph } from "./DependencyCycleGraph";
import { TrendChart } from "./TrendChart";

const SCORE_LABELS = [
  { key: "overallScore", label: "Overall" },
  { key: "architectureScore", label: "Architecture" },
  { key: "securityScore", label: "Security" },
  { key: "performanceScore", label: "Performance" },
  { key: "maintainabilityScore", label: "Maintainability" },
  { key: "scalabilityScore", label: "Scalability" },
  { key: "modularityScore", label: "Modularity" },
  { key: "layeringScore", label: "Layering" },
  { key: "documentationScore", label: "Documentation" },
  { key: "complexityScore", label: "Complexity" },
  { key: "technicalDebtScore", label: "Technical Debt" },
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

function ScoreCard({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className={cn("text-3xl font-semibold tabular-nums", scoreToneClass(score))}>{score ?? "—"}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {SCORE_LABELS.map(({ key, label }) => (
          <ScoreCard key={key} label={label} score={analysis ? (analysis[key] as number | null) : null} />
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
