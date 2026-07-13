import {
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
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { SyncStatus } from "../../types/repository.types";
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

export function RepositoryDetailPage() {
  const { orgSlug = "", repositoryId = "" } = useParams();
  const { data: organization } = useOrganization(orgSlug);
  const { data: repo, isLoading, isError, refetch } = useRepository(orgSlug, repositoryId);
  const syncRepository = useSyncRepository(orgSlug);

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">{repo.fullName}</h1>
            <a href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label="Open on GitHub" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="size-4" />
            </a>
          </div>
          <p className="text-sm text-muted-foreground">{repo.description ?? "No description"}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge tone={SYNC_STATUS_TONE[repo.syncStatus]}>{repo.syncStatus.toLowerCase()}</StatusBadge>
          {canManage && (
            <Button type="button" variant="outline" size="sm" onClick={() => syncRepository.mutate(repositoryId)} disabled={syncRepository.isPending}>
              <RefreshCw className={syncRepository.isPending ? "animate-spin" : undefined} />
              Sync now
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
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
                  <StatusBadge tone={INDEX_STATUS_TONE[indexStatus?.status ?? "PENDING"]}>
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
                <li key={branch.id} className="flex items-center justify-between p-3.5">
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
                <li key={commit.id} className="p-3.5">
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
                <li key={contributor.id} className="flex items-center gap-3 p-3.5">
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
              {pullRequests?.map((pr) => (
                <li key={pr.id} className="p-3.5">
                  <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:underline">
                    #{pr.number} {pr.title}
                  </a>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{pr.state.toLowerCase()}</Badge>
                    {pr.isDraft && "Draft ·"} {pr.authorLogin} · {pr.sourceBranch} → {pr.targetBranch}
                  </p>
                </li>
              ))}
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
              {issues?.map((issue) => (
                <li key={issue.id} className="p-3.5">
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
                </li>
              ))}
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
