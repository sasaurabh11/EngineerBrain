import { ExternalLink, FolderGit2, GitBranch, GitFork, HardDrive, Loader2, RefreshCw, Search, Star, Trash2, TriangleAlert } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PageHelp } from "@/components/page-help";
import { ScorePill } from "@/components/score-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { formatRelativeTime, formatSize } from "@/lib/utils";
import { useLatestAnalysis } from "../../hooks/useAnalysis";
import { useGitHubStatus } from "../../hooks/useGithub";
import { useOrganization } from "../../hooks/useOrganizations";
import {
  useAvailableRepositories,
  useImportRepositories,
  useRemoveRepository,
  useRepositories,
  useSyncRepository,
} from "../../hooks/useRepositories";
import type { ListRepositoriesFilters, Repository, SyncStatus } from "../../types/repository.types";
import { getManageGitHubInstallationUrl } from "../../utils/github";

const SYNC_STATUS_TONE: Record<SyncStatus, StatusTone> = {
  PENDING: "neutral",
  SYNCING: "info",
  SYNCED: "success",
  FAILED: "danger",
};

function RepositoryCard({
  orgSlug,
  repo,
  index,
  canManage,
  onNavigate,
  onSync,
  onRemove,
  syncPending,
}: {
  orgSlug: string;
  repo: Repository;
  index: number;
  canManage: boolean;
  onNavigate: () => void;
  onSync: () => void;
  onRemove: () => void;
  syncPending: boolean;
}) {
  const { data: analysis, isLoading: isLoadingAnalysis } = useLatestAnalysis(orgSlug, repo.id, true);

  return (
    <Card
      role="button"
      tabIndex={0}
      className="group hover-lift animate-fade-up cursor-pointer transition-colors hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={{ animationDelay: `${Math.min(index * 40, 320)}ms` }}
      onClick={onNavigate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate();
        }
      }}
    >
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <FolderGit2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{repo.fullName}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{repo.description ?? "No description"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isLoadingAnalysis ? (
              <Skeleton className="h-5 w-8" />
            ) : (
              <ScorePill score={analysis?.overallScore ?? null} size="sm" />
            )}
            <StatusBadge tone={SYNC_STATUS_TONE[repo.syncStatus]} pulse={repo.syncStatus === "SYNCING"}>
              {repo.syncStatus.toLowerCase()}
            </StatusBadge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {repo.primaryLanguage && (
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              {repo.primaryLanguage}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="size-3" />
            {repo.starsCount}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="size-3" />
            {repo.forksCount}
          </span>
          {repo.openIssuesCount > 0 && (
            <span className="flex items-center gap-1">
              <TriangleAlert className="size-3" />
              {repo.openIssuesCount} open
            </span>
          )}
          <span className="flex items-center gap-1">
            <GitBranch className="size-3" />
            {repo.defaultBranch}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" />
            {formatSize(repo.sizeKb)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">Synced {formatRelativeTime(repo.lastSyncedAt)}</p>

        {canManage && (
          <div className="flex items-center gap-3 border-t border-border pt-2.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSync();
              }}
              disabled={syncPending}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" /> Sync
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3" /> Remove
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RepositoriesListPage() {
  const { orgSlug = "" } = useParams();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgSlug);
  const { data: githubStatus } = useGitHubStatus(orgSlug);

  const [filters, setFilters] = useState<ListRepositoriesFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const { data: repositories, isLoading, isError, refetch } = useRepositories(orgSlug, filters);
  // Unfiltered, used only to populate the language filter's options regardless of the current filter selection.
  const { data: allRepositories } = useRepositories(orgSlug, {});
  const languages = useMemo(
    () => Array.from(new Set((allRepositories ?? []).map((r) => r.primaryLanguage).filter((l): l is string => Boolean(l)))).sort(),
    [allRepositories],
  );

  const [isImporting, setIsImporting] = useState(false);
  const { data: availableRepos, isLoading: isLoadingAvailable } = useAvailableRepositories(orgSlug, isImporting);
  const importRepositories = useImportRepositories(orgSlug);
  const removeRepository = useRemoveRepository(orgSlug);
  const syncRepository = useSyncRepository(orgSlug);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
  }

  function toggleSelected(githubRepoId: string) {
    setSelectedRepoIds((prev) =>
      prev.includes(githubRepoId) ? prev.filter((id) => id !== githubRepoId) : [...prev, githubRepoId],
    );
  }

  async function handleImport() {
    if (selectedRepoIds.length === 0) return;
    setActionError(null);
    try {
      await importRepositories.mutateAsync(selectedRepoIds);
      setSelectedRepoIds([]);
      setIsImporting(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to import repositories");
    }
  }

  async function handleRemove(repositoryId: string, name: string) {
    if (!window.confirm(`Remove "${name}"? All synced data for it will be deleted.`)) return;
    setActionError(null);
    try {
      await removeRepository.mutateAsync(repositoryId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove repository");
    }
  }

  async function handleSync(repositoryId: string) {
    setActionError(null);
    try {
      await syncRepository.mutateAsync(repositoryId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to trigger sync");
    }
  }

  if (!githubStatus?.connected) {
    return (
      <EmptyState
        icon={GitBranch}
        title="Connect GitHub"
        description="Connect your GitHub account to import and sync repositories."
        action={
          <Button asChild size="sm">
            <a href={`/app/${orgSlug}/settings`}>Go to settings</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-semibold text-foreground">Repositories</h1>
            <PageHelp title="What's on this page">
              <p>Every repository imported from GitHub, with its health score, stars, forks, open issues, size, and last sync time at a glance.</p>
              <p>
                Click <strong>Import repositories</strong> to pull in more from your connected GitHub installation. Use the search, language filter, and
                sort controls to find one quickly, or click a card to open its full detail view.
              </p>
              <p>Hover a card to reveal <strong>Sync</strong> (refresh from GitHub) and <strong>Remove</strong> actions.</p>
            </PageHelp>
          </div>
          <p className="text-sm text-muted-foreground">Repositories imported and analyzed in this organization.</p>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setIsImporting((prev) => !prev)} variant={isImporting ? "outline" : "default"}>
            {isImporting ? "Cancel" : "Import repositories"}
          </Button>
        )}
      </div>

      {actionError && <p className="text-sm text-destructive">{actionError}</p>}

      {isImporting && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Available repositories</h2>
            {githubStatus && getManageGitHubInstallationUrl(githubStatus) && (
              <a
                href={getManageGitHubInstallationUrl(githubStatus)!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Manage access on GitHub <ExternalLink className="size-3" />
              </a>
            )}
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoadingAvailable && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {availableRepos?.map((repo) => (
              <label
                key={repo.githubRepoId}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent has-disabled:opacity-60"
              >
                <span className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedRepoIds.includes(repo.githubRepoId)}
                    disabled={repo.alreadyImported}
                    onCheckedChange={() => toggleSelected(repo.githubRepoId)}
                  />
                  <span>
                    <p className="text-sm text-foreground">{repo.fullName}</p>
                    <p className="text-xs text-muted-foreground">{repo.description ?? "No description"}</p>
                  </span>
                </span>
                {repo.alreadyImported && (
                  <Badge variant="secondary" className="shrink-0">
                    Already imported
                  </Badge>
                )}
              </label>
            ))}
            {availableRepos && availableRepos.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No repositories available for this installation.</p>
            )}
            {availableRepos && availableRepos.length > 0 && (
              <Button type="button" className="mt-2" onClick={handleImport} disabled={selectedRepoIds.length === 0 || importRepositories.isPending}>
                {importRepositories.isPending && <Loader2 className="animate-spin" />}
                Import{selectedRepoIds.length > 0 ? ` ${selectedRepoIds.length}` : ""} selected
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={handleFilterSubmit} className="flex-1">
          <InputGroup className="max-w-sm">
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search repositories…"
            />
          </InputGroup>
        </form>
        <Select
          value={filters.language ?? "all"}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, language: value === "all" ? undefined : value }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {lang}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.sort ?? "imported"}
          onValueChange={(value) => setFilters((prev) => ({ ...prev, sort: value as ListRepositoriesFilters["sort"] }))}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="imported">Recently imported</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="stars">Most stars</SelectItem>
            <SelectItem value="updated">Recently pushed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {isError && <ErrorState message="Failed to load repositories." onRetry={() => refetch()} />}

      {!isLoading && !isError && repositories && repositories.length === 0 && (
        <EmptyState icon={FolderGit2} title="No repositories imported yet" description="Import a repository from GitHub to start analyzing it." />
      )}

      {!isLoading && !isError && repositories && repositories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo, index) => (
            <RepositoryCard
              key={repo.id}
              orgSlug={orgSlug}
              repo={repo}
              index={index}
              canManage={canManage}
              onNavigate={() => navigate(`/app/${orgSlug}/repositories/${repo.id}`)}
              onSync={() => handleSync(repo.id)}
              onRemove={() => handleRemove(repo.id, repo.fullName)}
              syncPending={syncRepository.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
