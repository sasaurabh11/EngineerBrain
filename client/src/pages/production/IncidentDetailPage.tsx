import { Download, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/error-state";
import { MarkdownContent } from "@/components/markdown-content";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { useOrganization } from "../../hooks/useOrganizations";
import { useCreateTask } from "../../hooks/useTasks";
import {
  useGeneratePostmortem,
  useIncident,
  useIncidentSignals,
  useIncidentTimeline,
  usePostmortem,
  useRecommendations,
  useRootCause,
} from "../../hooks/useProduction";
import type { IncidentSeverity, IncidentStatus, Recommendation, RecommendationPriority } from "../../types/production.types";

const STATUS_TONE: Record<IncidentStatus, StatusTone> = {
  DETECTED: "warning",
  INVESTIGATING: "info",
  ROOT_CAUSED: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};
const SEVERITY_TONE: Record<IncidentSeverity, StatusTone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" };
const PRIORITY_TONE: Record<RecommendationPriority, StatusTone> = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" };
const ACTIVE_STATUSES: IncidentStatus[] = ["DETECTED", "INVESTIGATING"];

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="rounded-lg border border-border p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={PRIORITY_TONE[recommendation.priority]}>{recommendation.priority}</StatusBadge>
        <Badge variant="secondary" className="text-[10px]">
          {recommendation.type.replace(/_/g, " ")}
        </Badge>
        <span className="text-xs tabular-nums text-muted-foreground">confidence {recommendation.confidenceScore}%</span>
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{recommendation.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{recommendation.description}</p>
      <p className="mt-2 text-xs text-muted-foreground italic">Why: {recommendation.rationale}</p>
      {recommendation.estimatedImpact && <p className="mt-1 text-xs text-muted-foreground">Estimated impact: {recommendation.estimatedImpact}</p>}
    </div>
  );
}

export function IncidentDetailPage() {
  const { orgSlug = "", incidentId = "" } = useParams();
  const { data: organization } = useOrganization(orgSlug);
  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  const { data: incident, isLoading, isError, refetch } = useIncident(orgSlug, incidentId);
  const isActive = incident ? ACTIVE_STATUSES.includes(incident.status) : false;

  const { data: timeline } = useIncidentTimeline(orgSlug, incidentId, isActive);
  const { data: signals } = useIncidentSignals(orgSlug, incidentId, isActive);
  const rootCauseQuery = useRootCause(orgSlug, incidentId, isActive);
  const recommendationsQuery = useRecommendations(orgSlug, incidentId, isActive);
  const postmortemQuery = usePostmortem(orgSlug, incidentId);

  const createTask = useCreateTask(orgSlug);
  const generatePostmortem = useGeneratePostmortem(orgSlug, incidentId);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRunAnalysis() {
    setActionError(null);
    try {
      await createTask.mutateAsync({
        goal: `Investigate incident: ${incident?.title ?? incidentId}`,
        workflowKey: "incident-analysis",
        workflowParams: { incidentId },
      });
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start analysis");
    }
  }

  async function handleGeneratePostmortem() {
    setActionError(null);
    try {
      await generatePostmortem.mutateAsync();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to generate postmortem");
    }
  }

  if (isError) {
    return <ErrorState title="Failed to load incident" message="Something went wrong fetching this incident." onRetry={() => refetch()} />;
  }
  if (isLoading || !incident) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading incident…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</StatusBadge>
            <StatusBadge tone={STATUS_TONE[incident.status]} pulse={isActive}>
              {incident.status.replace("_", " ").toLowerCase()}
            </StatusBadge>
          </div>
          <h1 className="mt-1.5 text-lg font-semibold text-foreground">{incident.title}</h1>
          <p className="text-xs text-muted-foreground">
            Detected {new Date(incident.detectedAt).toLocaleString()}
            {incident.resolvedAt && ` · Resolved ${new Date(incident.resolvedAt).toLocaleString()}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {incident.taskId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/${orgSlug}/tasks/${incident.taskId}`}>
                Execution trace <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          )}
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={handleRunAnalysis} disabled={createTask.isPending || isActive}>
              {createTask.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {incident.taskId ? "Re-run analysis" : "Run analysis"}
            </Button>
          )}
        </div>
      </div>
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {/* Timeline */}
      <div>
        <p className="mb-3 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Timeline</p>
        {!timeline || timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isActive ? "Correlating evidence…" : "No timeline events recorded."}
          </p>
        ) : (
          <ul className="space-y-0">
            {timeline.map((event, i) => (
              <li key={event.id} className="relative flex gap-4 pb-5">
                {i !== timeline.length - 1 && <span className="absolute top-3 left-[5px] h-full w-px bg-border" aria-hidden="true" />}
                <span className="z-10 mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-primary bg-background" />
                <div>
                  <p className="text-sm text-foreground">{event.description}</p>
                  <p className="text-xs text-muted-foreground">{new Date(event.occurredAt).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Correlated evidence */}
      <div>
        <p className="mb-3 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Correlated evidence</p>
        {!signals || signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isActive ? "Gathering evidence…" : "No evidence correlated yet."}</p>
        ) : (
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {signals.map((signal) => (
                <li key={signal.id} className="flex items-start gap-3 p-3">
                  <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-[10px]">
                    {signal.signalType}
                  </Badge>
                  <p className="text-sm text-foreground">{signal.summary}</p>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">{signal.relevanceScore}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {/* Root cause */}
      <div>
        <p className="mb-3 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Root cause analysis</p>
        {rootCauseQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rootCauseQuery.isError && (
          <p className="text-sm text-muted-foreground">
            {rootCauseQuery.error instanceof Error ? rootCauseQuery.error.message : "Root cause analysis is not available yet."}
          </p>
        )}
        {rootCauseQuery.data && (
          <Card>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{rootCauseQuery.data.mostLikelyCause}</span>
                <span className="text-xs tabular-nums text-muted-foreground">confidence {rootCauseQuery.data.confidenceScore}%</span>
              </div>
              <p className="text-sm text-muted-foreground">{rootCauseQuery.data.summary}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                {rootCauseQuery.data.responsibleCommitSha && <span>Commit: {rootCauseQuery.data.responsibleCommitSha.slice(0, 7)}</span>}
                {rootCauseQuery.data.responsiblePullRequestId && <span>PR ref: {rootCauseQuery.data.responsiblePullRequestId}</span>}
                {rootCauseQuery.data.responsibleUserId && <span>Owner ref: {rootCauseQuery.data.responsibleUserId}</span>}
              </div>
              {rootCauseQuery.data.rollbackRecommended && (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-2.5 text-sm text-warning">Rollback recommended.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      <div>
        <p className="mb-3 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Recommendations</p>
        {recommendationsQuery.isError && <p className="text-sm text-muted-foreground">Recommendations aren't available yet.</p>}
        {recommendationsQuery.data && recommendationsQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">{isActive ? "Generating recommendations…" : "No recommendations generated."}</p>
        )}
        {recommendationsQuery.data && recommendationsQuery.data.length > 0 && (
          <div className={cn("space-y-3")}>
            {recommendationsQuery.data.map((r) => (
              <RecommendationCard key={r.id} recommendation={r} />
            ))}
          </div>
        )}
      </div>

      {/* Postmortem */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Postmortem</p>
          {canManage && rootCauseQuery.data && (
            <div className="flex gap-2">
              {postmortemQuery.data && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadMarkdown(
                      `postmortem-${incident.id}.md`,
                      `# ${incident.title}\n\n${postmortemQuery.data!.executiveSummary}\n\n## Root cause\n${postmortemQuery.data!.rootCauseMarkdown}\n\n## Timeline\n${postmortemQuery.data!.timelineMarkdown}\n\n## Contributing factors\n${postmortemQuery.data!.contributingFactors ?? ""}\n\n## Customer impact\n${postmortemQuery.data!.customerImpact ?? ""}\n\n## Recovery\n${postmortemQuery.data!.recoverySteps ?? ""}\n\n## Lessons learned\n${postmortemQuery.data!.lessonsLearned ?? ""}\n\n## Action items\n${(postmortemQuery.data!.actionItems ?? []).map((a) => `- ${a.description}`).join("\n")}`,
                    )
                  }
                >
                  <Download className="size-3.5" /> Download .md
                </Button>
              )}
              <Button type="button" size="sm" onClick={handleGeneratePostmortem} disabled={generatePostmortem.isPending}>
                {generatePostmortem.isPending && <Loader2 className="animate-spin" />}
                {postmortemQuery.data ? "Regenerate" : "Generate postmortem"}
              </Button>
            </div>
          )}
        </div>
        {!rootCauseQuery.data && <p className="text-sm text-muted-foreground">A postmortem can be generated once root cause analysis completes.</p>}
        {rootCauseQuery.data && !postmortemQuery.data && !postmortemQuery.isLoading && (
          <p className="text-sm text-muted-foreground">No postmortem generated yet.</p>
        )}
        {postmortemQuery.data && (
          <Card>
            <CardContent className="space-y-4">
              <MarkdownContent content={postmortemQuery.data.executiveSummary} />
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Root cause</p>
                <MarkdownContent content={postmortemQuery.data.rootCauseMarkdown} className="mt-1" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Timeline</p>
                <MarkdownContent content={postmortemQuery.data.timelineMarkdown} className="mt-1" />
              </div>
              {postmortemQuery.data.lessonsLearned && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lessons learned</p>
                  <MarkdownContent content={postmortemQuery.data.lessonsLearned} className="mt-1" />
                </div>
              )}
              {postmortemQuery.data.actionItems && postmortemQuery.data.actionItems.length > 0 && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Action items</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-foreground">
                    {postmortemQuery.data.actionItems.map((item, i) => (
                      <li key={i}>{item.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
