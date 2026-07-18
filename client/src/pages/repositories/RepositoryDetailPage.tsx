import {
  Bot,
  ChevronDown,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { MarkdownContent } from "@/components/markdown-content";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useOrganization } from "../../hooks/useOrganizations";
import { useIndexStatus, useReindex, useTriggerIndex } from "../../hooks/useIndexing";
import {
  useBranches,
  useCommits,
  useContributors,
  useIssues,
  usePullRequests,
  useRepository,
  useSyncRepository,
} from "../../hooks/useRepositories";
import { useCreateTask, useLatestWorkflowTask } from "../../hooks/useTasks";
import type { SyncStatus } from "../../types/repository.types";
import type { TaskStatus } from "../../types/task.types";
import { HealthDashboard } from "./components/HealthDashboard";

const TABS = ["overview", "knowledge", "health", "branches", "commits", "contributors", "pull-requests", "issues"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  knowledge: "Knowledge",
  health: "Health",
  branches: "Branches",
  commits: "Commits",
  contributors: "Contributors",
  "pull-requests": "Pull Requests",
  issues: "Issues",
};

const SYNC_STATUS_TONE: Record<SyncStatus, StatusTone> = {
  PENDING: "neutral",
  SYNCING: "info",
  SYNCED: "success",
  FAILED: "danger",
};

const INDEX_STATUS_TONE: Record<string, StatusTone> = {
  PENDING: "neutral",
  INDEXING: "info",
  INDEXED: "success",
  FAILED: "danger",
};

const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  PENDING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

/** Wraps one PR/issue row's own header content with the latest auto- or
 * manually-triggered analysis for it, shown expanded inline right below -
 * so the result is visible on this page without opening the Task Center,
 * while still linking out to the full execution trace for power users. */
function WorkflowAnalysisRow({
  orgSlug,
  repositoryId,
  workflowKey,
  target,
  label,
  canManage,
  launching,
  onRun,
  header,
}: {
  orgSlug: string;
  repositoryId: string;
  workflowKey: string;
  target: { prNumber?: number; issueNumber?: number };
  label: string;
  canManage: boolean;
  launching: boolean;
  onRun: () => void;
  header: ReactNode;
}) {
  const { data: task } = useLatestWorkflowTask(orgSlug, repositoryId, workflowKey, target);
  const [expanded, setExpanded] = useState(true);

  return (
    <li className="p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">{header}</div>
        <div className="flex shrink-0 items-center gap-2">
          {task && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <StatusBadge tone={TASK_STATUS_TONE[task.status]}>
                {label}: {task.status.replace("_", " ").toLowerCase()}
              </StatusBadge>
              <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
          )}
          {canManage && (
            <Button type="button" variant="outline" size="sm" disabled={launching} onClick={onRun}>
              {launching ? <Loader2 className="animate-spin" /> : <Bot />}
              Run AI {label.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      {task && expanded && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3.5">
          {task.status === "COMPLETED" && task.resultSummary && <MarkdownContent content={task.resultSummary} />}
          {task.status === "COMPLETED" && !task.resultSummary && <p className="text-sm text-muted-foreground">Completed with no summary.</p>}
          {task.status === "FAILED" && <ErrorState title="Analysis failed" message={task.errorMessage ?? "Something went wrong."} />}
          {(task.status === "QUEUED" || task.status === "RUNNING") && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Analyzing…
            </p>
          )}
          {task.status === "PENDING_APPROVAL" && (
            <p className="text-sm text-warning">
              This analysis wants to post back to GitHub and is waiting for an OWNER/ADMIN to approve it.
            </p>
          )}
          {task.status === "CANCELLED" && <p className="text-sm text-muted-foreground">This analysis was cancelled.</p>}
          <Link to={`/app/${orgSlug}/tasks/${task.id}`} className="mt-3 inline-block text-xs text-primary hover:underline">
            View full execution trace →
          </Link>
        </div>
      )}
    </li>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-mono text-[10.5px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function RepositoryDetailPage() {
  const { orgSlug = "", repositoryId = "" } = useParams();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgSlug);
  const { data: repo, isLoading, isError, refetch } = useRepository(orgSlug, repositoryId);
  const syncRepository = useSyncRepository(orgSlug);
  const createTask = useCreateTask(orgSlug);
  const [launchingTaskFor, setLaunchingTaskFor] = useState<string | null>(null);

  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const [tab, setTab] = useState<Tab>("overview");

  const { data: indexStatus } = useIndexStatus(orgSlug, repositoryId);
  const triggerIndex = useTriggerIndex(orgSlug, repositoryId);
  const reindex = useReindex(orgSlug, repositoryId);

  const { data: branches } = useBranches(orgSlug, tab === "branches" ? repositoryId : undefined);
  const { data: commits } = useCommits(orgSlug, tab === "commits" ? repositoryId : undefined);
  const { data: contributors } = useContributors(orgSlug, tab === "contributors" ? repositoryId : undefined);
  const { data: pullRequests } = usePullRequests(orgSlug, tab === "pull-requests" ? repositoryId : undefined);
  const { data: issues } = useIssues(orgSlug, tab === "issues" ? repositoryId : undefined);

  async function runWorkflow(key: string, opts: { taskKey: string; goal: string; workflowParams: Record<string, unknown> }) {
    setLaunchingTaskFor(opts.taskKey);
    try {
      const task = await createTask.mutateAsync({
        goal: opts.goal,
        repositoryId,
        workflowKey: key,
        workflowParams: opts.workflowParams,
      });
      navigate(`/app/${orgSlug}/tasks/${task.id}`);
    } finally {
      setLaunchingTaskFor(null);
    }
  }

  if (isError) {
    return <ErrorState title="Failed to load repository" message="Something went wrong fetching this repository." onRetry={() => refetch()} />;
  }

  if (isLoading || !repo) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading repository…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 animate-fade-up">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-semibold text-foreground">{repo.fullName}</h1>
            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label="Open on GitHub" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-4" />
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{repo.description ?? "No description"}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={SYNC_STATUS_TONE[repo.syncStatus]} pulse={repo.syncStatus === "SYNCING"}>
            {repo.syncStatus.toLowerCase()}
          </StatusBadge>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={() => syncRepository.mutate(repositoryId)} disabled={syncRepository.isPending}>
              <RefreshCw className={syncRepository.isPending ? "animate-spin" : undefined} />
              Sync now
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto border-b border-border p-0">
          {TABS.map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
            >
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label="Visibility" value={repo.visibility} />
          <InfoRow label="Default branch" value={repo.defaultBranch} />
          <InfoRow label="Primary language" value={repo.primaryLanguage ?? "—"} />
          <InfoRow label="Topics" value={repo.topics.length > 0 ? repo.topics.join(", ") : "—"} />
          <InfoRow label="Stars" value={String(repo.starsCount)} />
          <InfoRow label="Forks" value={String(repo.forksCount)} />
          <InfoRow label="Open issues" value={String(repo.openIssuesCount)} />
          <InfoRow label="Size" value={`${repo.sizeKb} KB`} />
          <InfoRow label="Last pushed" value={repo.githubPushedAt ? new Date(repo.githubPushedAt).toLocaleString() : "—"} />
          <InfoRow label="Last synced" value={repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : "Never"} />
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-4 pt-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm text-foreground">
                  Indexing status
                  <StatusBadge tone={INDEX_STATUS_TONE[indexStatus?.status ?? "PENDING"]} pulse={indexStatus?.status === "INDEXING"}>
                    {(indexStatus?.status ?? "PENDING").toLowerCase()}
                  </StatusBadge>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {indexStatus?.lastIndexedAt
                    ? `Last indexed ${new Date(indexStatus.lastIndexedAt).toLocaleString()}`
                    : "This repository hasn't been indexed yet — the AI assistant won't have any context on it until it is."}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => triggerIndex.mutate()}
                    disabled={indexStatus?.status === "INDEXING" || triggerIndex.isPending}
                  >
                    {indexStatus?.status === "PENDING" ? "Start indexing" : "Index changes"}
                  </Button>
                  {indexStatus?.status === "INDEXED" && (
                    <Button type="button" variant="outline" size="sm" onClick={() => reindex.mutate()} disabled={reindex.isPending}>
                      Full re-index
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {indexStatus?.status === "INDEXED" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <InfoRow label="Files indexed" value={String(indexStatus.totalFiles)} />
                <InfoRow label="Symbols extracted" value={String(indexStatus.totalSymbols)} />
                <InfoRow label="Chunks embedded" value={String(indexStatus.totalChunks)} />
              </div>
              <InfoRow
                label="Detected frameworks"
                value={indexStatus.detectedFrameworks.length > 0 ? indexStatus.detectedFrameworks.join(", ") : "None detected"}
              />
              <Button asChild size="sm">
                <Link to={`/app/${orgSlug}/ai?repositoryId=${repositoryId}`}>
                  <Sparkles /> Ask the AI assistant about this repository
                </Link>
              </Button>
            </>
          )}
        </TabsContent>

        <TabsContent value="health" className="pt-4">
          <HealthDashboard orgSlug={orgSlug} repositoryId={repositoryId} />
        </TabsContent>

        <TabsContent value="branches" className="pt-4">
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {branches?.map((branch) => (
                <li key={branch.id} className="group relative flex items-center justify-between p-3.5 transition-colors hover:bg-accent/50">
                  <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-foreground">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {branch.lastCommitSha.slice(0, 7)}
                        {branch.lastCommitAt && ` · ${new Date(branch.lastCommitAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {branch.isProtected && <Badge variant="secondary">Protected</Badge>}
                </li>
              ))}
              {branches?.length === 0 && (
                <li className="p-6">
                  <EmptyState icon={GitBranch} title="No branches synced yet" />
                </li>
              )}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="commits" className="pt-4">
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {commits?.map((commit) => (
                <li key={commit.id} className="group relative p-3.5 transition-colors hover:bg-accent/50">
                  <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                  <a href={commit.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:underline">
                    {commit.message.split("\n")[0]}
                  </a>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <GitCommitHorizontal className="size-3" />
                    {commit.authorGithubLogin ?? commit.authorName} · {new Date(commit.committedAt).toLocaleString()} · {commit.sha.slice(0, 7)}
                  </p>
                </li>
              ))}
              {commits?.length === 0 && (
                <li className="p-6">
                  <EmptyState icon={GitCommitHorizontal} title="No commits synced yet" />
                </li>
              )}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="contributors" className="pt-4">
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {contributors?.map((contributor) => (
                <li key={contributor.id} className="group relative flex items-center gap-3 p-3.5 transition-colors hover:bg-accent/50">
                  <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                  <Avatar className="size-8">
                    <AvatarImage src={contributor.avatarUrl ?? undefined} alt={contributor.githubLogin} />
                    <AvatarFallback>{contributor.githubLogin.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm text-foreground">{contributor.githubLogin}</p>
                    <p className="text-xs text-muted-foreground">{contributor.contributions} contributions</p>
                  </div>
                </li>
              ))}
              {contributors?.length === 0 && (
                <li className="p-6">
                  <EmptyState icon={Users} title="No contributors synced yet" />
                </li>
              )}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="pull-requests" className="pt-4">
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {pullRequests?.map((pr) => {
                const taskKey = `pr-${pr.number}`;
                return (
                  <WorkflowAnalysisRow
                    key={pr.id}
                    orgSlug={orgSlug}
                    repositoryId={repositoryId}
                    workflowKey="pr-review"
                    target={{ prNumber: pr.number }}
                    label="Review"
                    canManage={canManage}
                    launching={launchingTaskFor === taskKey}
                    onRun={() =>
                      runWorkflow("pr-review", {
                        taskKey,
                        goal: `Review pull request #${pr.number}: ${pr.title}`,
                        workflowParams: { prNumber: pr.number },
                      })
                    }
                    header={
                      <>
                        <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:underline">
                          #{pr.number} {pr.title}
                        </a>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{pr.state.toLowerCase()}</Badge>
                          {pr.isDraft && "Draft ·"} {pr.authorLogin} · {pr.sourceBranch} → {pr.targetBranch}
                        </p>
                      </>
                    }
                  />
                );
              })}
              {pullRequests?.length === 0 && (
                <li className="p-6">
                  <EmptyState icon={GitPullRequest} title="No pull requests synced yet" />
                </li>
              )}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="pt-4">
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {issues?.map((issue) => {
                const taskKey = `issue-${issue.number}`;
                return (
                  <WorkflowAnalysisRow
                    key={issue.id}
                    orgSlug={orgSlug}
                    repositoryId={repositoryId}
                    workflowKey="issue-triage"
                    target={{ issueNumber: issue.number }}
                    label="Triage"
                    canManage={canManage}
                    launching={launchingTaskFor === taskKey}
                    onRun={() =>
                      runWorkflow("issue-triage", {
                        taskKey,
                        goal: `Triage issue #${issue.number}: ${issue.title}`,
                        workflowParams: { issueNumber: issue.number },
                      })
                    }
                    header={
                      <>
                        <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:underline">
                          #{issue.number} {issue.title}
                        </a>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{issue.state.toLowerCase()}</Badge>
                          {issue.authorLogin}
                          {issue.labels.map((label) => (
                            <Badge key={label} variant="outline">
                              {label}
                            </Badge>
                          ))}
                        </p>
                      </>
                    }
                  />
                );
              })}
              {issues?.length === 0 && (
                <li className="p-6">
                  <EmptyState icon={GitPullRequest} title="No issues synced yet" />
                </li>
              )}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
