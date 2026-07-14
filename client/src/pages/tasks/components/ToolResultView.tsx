import { ExternalLink, FileDiff, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const CI_TONE: Record<string, StatusTone> = {
  passing: "success",
  failing: "danger",
  pending_or_unknown: "warning",
};

const CONCLUSION_TONE: Record<string, StatusTone> = {
  success: "success",
  failure: "danger",
  neutral: "neutral",
  action_required: "warning",
  timed_out: "danger",
  cancelled: "neutral",
};

const SEVERITY_TONE: Record<string, StatusTone> = {
  CRITICAL: "danger",
  HIGH: "danger",
  MEDIUM: "warning",
  LOW: "info",
  INFO: "neutral",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-xs text-foreground">{value}</p>
    </div>
  );
}

function PrDetailsResult({ result }: { result: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{String(result.state)}</Badge>
        {result.isDraft ? <Badge variant="outline">Draft</Badge> : null}
        {typeof result.htmlUrl === "string" && (
          <a href={result.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View on GitHub <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{String(result.title)}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Author" value={String(result.author ?? "—")} />
        <Field label="Branches" value={`${result.baseRef} ← ${result.headRef}`} />
        <Field label="Changes" value={`+${result.additions} / −${result.deletions} (${result.changedFiles} files)`} />
        <Field label="Mergeable" value={String(result.mergeableState ?? "unknown")} />
      </div>
    </div>
  );
}

function PrDiffResult({ result }: { result: Record<string, unknown> }) {
  const files = (result.files as { filename: string; status: string; additions: number; deletions: number }[]) ?? [];
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {String(result.totalFiles)} file{result.totalFiles === 1 ? "" : "s"} changed{result.truncated ? " (truncated)" : ""}
      </p>
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.filename} className="flex items-center justify-between gap-2 font-mono text-xs">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-foreground">
              <FileDiff className="size-3 shrink-0 text-muted-foreground" />
              <span className="truncate">{f.filename}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              <span className="text-success">+{f.additions}</span> <span className="text-destructive">−{f.deletions}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CiStatusResult({ result }: { result: Record<string, unknown> }) {
  const checkRuns = (result.checkRuns as { name: string; status: string; conclusion: string | null; htmlUrl: string }[]) ?? [];
  const statuses = (result.statuses as { context: string; state: string; description: string | null }[]) ?? [];
  return (
    <div className="space-y-3">
      <StatusBadge tone={CI_TONE[String(result.overall)] ?? "neutral"}>{String(result.overall).replace(/_/g, " ")}</StatusBadge>
      {checkRuns.length > 0 && (
        <ul className="space-y-1">
          {checkRuns.map((c) => (
            <li key={c.name} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{c.name}</span>
              <StatusBadge tone={CONCLUSION_TONE[c.conclusion ?? c.status] ?? "neutral"} className="shrink-0">
                {c.conclusion ?? c.status}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
      {statuses.length > 0 && (
        <ul className="space-y-1">
          {statuses.map((s) => (
            <li key={s.context} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{s.context}</span>
              <StatusBadge tone={CONCLUSION_TONE[s.state] ?? "neutral"} className="shrink-0">
                {s.state}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PrDependencyDiffResult({ result }: { result: Record<string, unknown> }) {
  const deps =
    (result.newOrChangedDependencies as {
      name: string;
      ecosystem: string;
      previousVersion: string | null;
      newVersion: string;
      vulnerabilityCount: number;
      vulnerabilities: { id: string; summary?: string }[];
    }[]) ?? [];

  if (deps.length === 0) {
    return <p className="text-xs text-muted-foreground">No dependency manifest changes in this pull request.</p>;
  }

  return (
    <ul className="space-y-2">
      {deps.map((d) => (
        <li key={d.name} className="rounded-md border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-foreground">
              {d.name} <span className="text-muted-foreground">({d.ecosystem})</span>
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {d.previousVersion ?? "new"} → {d.newVersion}
            </span>
          </div>
          {d.vulnerabilityCount > 0 ? (
            <div className="mt-1.5 space-y-1">
              {d.vulnerabilities.map((v) => (
                <p key={v.id} className="flex items-start gap-1.5 text-xs text-destructive">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0" />
                  <span>
                    <span className="font-mono">{v.id}</span>
                    {v.summary ? ` — ${v.summary}` : ""}
                  </span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs text-success">No known vulnerabilities</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function PrStaticAnalysisResult({ result }: { result: Record<string, unknown> }) {
  if (result.found === false) {
    return <p className="text-xs text-muted-foreground">{String(result.message)}</p>;
  }
  const findings =
    (result.findings as { severity: string; category: string; title: string; filePath: string | null; startLine: number | null }[]) ?? [];

  if (findings.length === 0) {
    return <p className="text-xs text-muted-foreground">{String(result.message ?? "No findings for the files changed by this PR.")}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {String(result.totalFindings)} finding{result.totalFindings === 1 ? "" : "s"} across {String(result.filesAnalyzed)} changed file
        {result.filesAnalyzed === 1 ? "" : "s"}
      </p>
      <ul className="space-y-1.5">
        {findings.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <StatusBadge tone={SEVERITY_TONE[f.severity] ?? "neutral"} className="mt-0.5 shrink-0">
              {f.severity.toLowerCase()}
            </StatusBadge>
            <span className="min-w-0">
              <span className="text-foreground">{f.title}</span>
              {f.filePath && (
                <span className="block font-mono text-muted-foreground">
                  {f.filePath}
                  {f.startLine ? `:${f.startLine}` : ""}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IssueDetailsResult({ result }: { result: Record<string, unknown> }) {
  const labels = (result.labels as string[]) ?? [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{String(result.state)}</Badge>
        {labels.map((l) => (
          <Badge key={l} variant="outline">
            {l}
          </Badge>
        ))}
        {typeof result.htmlUrl === "string" && (
          <a href={result.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View on GitHub <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <p className="text-sm font-medium text-foreground">{String(result.title)}</p>
      <p className="text-xs text-muted-foreground">
        Opened by {String(result.author ?? "unknown")} · {String(result.commentCount)} comment{result.commentCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function PostCheckRunResult({ result }: { result: Record<string, unknown> }) {
  return (
    <a href={String(result.htmlUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      View posted check run on GitHub <ExternalLink className="size-3" />
    </a>
  );
}

const RENDERERS: Record<string, (props: { result: Record<string, unknown> }) => React.ReactElement> = {
  pr_details: PrDetailsResult,
  pr_diff: PrDiffResult,
  ci_status: CiStatusResult,
  pr_dependency_diff: PrDependencyDiffResult,
  pr_static_analysis: PrStaticAnalysisResult,
  issue_details: IssueDetailsResult,
  post_check_run: PostCheckRunResult,
};

export function ToolResultView({ toolName, result, className }: { toolName: string; result: unknown; className?: string }) {
  const Renderer = RENDERERS[toolName];
  if (Renderer && result && typeof result === "object") {
    return (
      <div className={className}>
        <Renderer result={result as Record<string, unknown>} />
      </div>
    );
  }

  return (
    <pre className={cn("max-h-64 overflow-auto rounded-md bg-muted p-2.5 font-mono text-xs whitespace-pre-wrap text-foreground", className)}>
      {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
    </pre>
  );
}
