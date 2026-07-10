import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
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

const TABS = ["Overview", "Knowledge", "Branches", "Commits", "Contributors", "Pull Requests", "Issues"] as const;
type Tab = (typeof TABS)[number];

const SYNC_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  SYNCING: "bg-blue-100 text-blue-700",
  SYNCED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

const INDEX_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  INDEXING: "bg-blue-100 text-blue-700",
  INDEXED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}

export function RepositoryDetailPage() {
  const { orgSlug = "", repositoryId = "" } = useParams();
  const { data: organization } = useOrganization(orgSlug);
  const { data: repo, isLoading } = useRepository(orgSlug, repositoryId);
  const syncRepository = useSyncRepository(orgSlug);
  const [tab, setTab] = useState<Tab>("Overview");
  const [syncError, setSyncError] = useState<string | null>(null);

  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  const { data: indexStatus } = useIndexStatus(orgSlug, repositoryId);
  const triggerIndex = useTriggerIndex(orgSlug, repositoryId);
  const reindex = useReindex(orgSlug, repositoryId);

  const { data: branches } = useBranches(orgSlug, tab === "Branches" ? repositoryId : undefined);
  const { data: commits } = useCommits(orgSlug, tab === "Commits" ? repositoryId : undefined);
  const { data: contributors } = useContributors(orgSlug, tab === "Contributors" ? repositoryId : undefined);
  const { data: pullRequests } = usePullRequests(orgSlug, tab === "Pull Requests" ? repositoryId : undefined);
  const { data: issues } = useIssues(orgSlug, tab === "Issues" ? repositoryId : undefined);

  async function handleSync() {
    setSyncError(null);
    try {
      await syncRepository.mutateAsync(repositoryId);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to trigger sync");
    }
  }

  if (isLoading || !repo) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{repo.fullName}</h1>
          <p className="text-sm text-gray-500">{repo.description ?? "No description"}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${SYNC_STATUS_STYLES[repo.syncStatus] ?? "bg-gray-100 text-gray-600"}`}
          >
            {repo.syncStatus}
          </span>
          {canManage && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncRepository.isPending}
              className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {syncRepository.isPending ? "Syncing..." : "Sync now"}
            </button>
          )}
        </div>
      </div>
      {syncError && <p className="text-sm text-red-600">{syncError}</p>}

      <nav className="flex gap-4 border-b border-gray-200 text-sm">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-1 pb-2 ${
              tab === t
                ? "border-gray-900 font-medium text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="Visibility" value={repo.visibility} />
          <InfoRow label="Default branch" value={repo.defaultBranch} />
          <InfoRow label="Primary language" value={repo.primaryLanguage ?? "—"} />
          <InfoRow label="Topics" value={repo.topics.length > 0 ? repo.topics.join(", ") : "—"} />
          <InfoRow label="Stars" value={String(repo.starsCount)} />
          <InfoRow label="Forks" value={String(repo.forksCount)} />
          <InfoRow label="Open issues" value={String(repo.openIssuesCount)} />
          <InfoRow label="Size" value={`${repo.sizeKb} KB`} />
          <InfoRow
            label="Last pushed"
            value={repo.githubPushedAt ? new Date(repo.githubPushedAt).toLocaleString() : "—"}
          />
          <InfoRow label="Last synced" value={repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : "Never"} />
          <InfoRow
            label="Links"
            value={
              <a href={repo.htmlUrl} target="_blank" rel="noreferrer" className="text-gray-900 underline">
                View on GitHub
              </a>
            }
          />
        </div>
      )}

      {tab === "Knowledge" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded border border-gray-200 bg-white p-4">
            <div>
              <p className="text-sm text-gray-900">
                Indexing status:{" "}
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    INDEX_STATUS_STYLES[indexStatus?.status ?? "PENDING"]
                  }`}
                >
                  {indexStatus?.status ?? "PENDING"}
                </span>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {indexStatus?.lastIndexedAt
                  ? `Last indexed ${new Date(indexStatus.lastIndexedAt).toLocaleString()}`
                  : "This repository hasn't been indexed yet - the AI assistant won't have any context on it until it is."}
              </p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => triggerIndex.mutate()}
                  disabled={indexStatus?.status === "INDEXING" || triggerIndex.isPending}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {indexStatus?.status === "PENDING" ? "Start indexing" : "Index changes"}
                </button>
                {indexStatus?.status === "INDEXED" && (
                  <button
                    type="button"
                    onClick={() => reindex.mutate()}
                    disabled={reindex.isPending}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Full re-index
                  </button>
                )}
              </div>
            )}
          </div>

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
              <Link
                to={`/app/${orgSlug}/ai?repositoryId=${repositoryId}`}
                className="inline-block text-sm text-blue-600 underline"
              >
                Ask the AI assistant about this repository
              </Link>
            </>
          )}
        </div>
      )}

      {tab === "Branches" && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {branches?.map((branch) => (
            <li key={branch.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm text-gray-900">{branch.name}</p>
                <p className="text-xs text-gray-500">
                  {branch.lastCommitSha.slice(0, 7)}
                  {branch.lastCommitAt && ` · ${new Date(branch.lastCommitAt).toLocaleDateString()}`}
                </p>
              </div>
              {branch.isProtected && <span className="text-xs text-gray-500">Protected</span>}
            </li>
          ))}
          {branches?.length === 0 && <li className="p-3 text-sm text-gray-500">No branches synced yet.</li>}
        </ul>
      )}

      {tab === "Commits" && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {commits?.map((commit) => (
            <li key={commit.id} className="p-3">
              <a href={commit.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-gray-900 hover:underline">
                {commit.message.split("\n")[0]}
              </a>
              <p className="text-xs text-gray-500">
                {commit.authorGithubLogin ?? commit.authorName} · {new Date(commit.committedAt).toLocaleString()} ·{" "}
                {commit.sha.slice(0, 7)}
              </p>
            </li>
          ))}
          {commits?.length === 0 && <li className="p-3 text-sm text-gray-500">No commits synced yet.</li>}
        </ul>
      )}

      {tab === "Contributors" && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {contributors?.map((contributor) => (
            <li key={contributor.id} className="flex items-center gap-3 p-3">
              {contributor.avatarUrl && <img src={contributor.avatarUrl} alt="" className="h-8 w-8 rounded-full" />}
              <div>
                <p className="text-sm text-gray-900">{contributor.githubLogin}</p>
                <p className="text-xs text-gray-500">{contributor.contributions} contributions</p>
              </div>
            </li>
          ))}
          {contributors?.length === 0 && <li className="p-3 text-sm text-gray-500">No contributors synced yet.</li>}
        </ul>
      )}

      {tab === "Pull Requests" && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {pullRequests?.map((pr) => (
            <li key={pr.id} className="p-3">
              <a href={pr.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-gray-900 hover:underline">
                #{pr.number} {pr.title}
              </a>
              <p className="text-xs text-gray-500">
                {pr.state}
                {pr.isDraft && " · Draft"} · {pr.authorLogin} · {pr.sourceBranch} → {pr.targetBranch}
              </p>
            </li>
          ))}
          {pullRequests?.length === 0 && <li className="p-3 text-sm text-gray-500">No pull requests synced yet.</li>}
        </ul>
      )}

      {tab === "Issues" && (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
          {issues?.map((issue) => (
            <li key={issue.id} className="p-3">
              <a href={issue.htmlUrl} target="_blank" rel="noreferrer" className="text-sm text-gray-900 hover:underline">
                #{issue.number} {issue.title}
              </a>
              <p className="text-xs text-gray-500">
                {issue.state} · {issue.authorLogin}
                {issue.labels.length > 0 && ` · ${issue.labels.join(", ")}`}
              </p>
            </li>
          ))}
          {issues?.length === 0 && <li className="p-3 text-sm text-gray-500">No issues synced yet.</li>}
        </ul>
      )}
    </div>
  );
}
