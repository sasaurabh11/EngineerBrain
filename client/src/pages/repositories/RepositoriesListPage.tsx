import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGitHubStatus } from "../../hooks/useGithub";
import { useOrganization } from "../../hooks/useOrganizations";
import {
  useAvailableRepositories,
  useImportRepositories,
  useRemoveRepository,
  useRepositories,
  useSyncRepository,
} from "../../hooks/useRepositories";
import type { ListRepositoriesFilters } from "../../types/repository.types";

const SYNC_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  SYNCING: "bg-blue-100 text-blue-700",
  SYNCED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
};

export function RepositoriesListPage() {
  const { orgSlug = "" } = useParams();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgSlug);
  const { data: githubStatus } = useGitHubStatus(orgSlug);

  const [filters, setFilters] = useState<ListRepositoriesFilters>({});
  const [searchInput, setSearchInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const { data: repositories, isLoading } = useRepositories(orgSlug, filters);

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
    setFilters((prev) => ({ ...prev, search: searchInput || undefined, language: languageInput || undefined }));
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
      <div className="rounded border border-gray-200 bg-white p-6 text-center">
        <p className="mb-3 text-sm text-gray-600">Connect GitHub to import and sync repositories.</p>
        <Link to={`/app/${orgSlug}/settings`} className="text-sm font-medium text-gray-900 underline">
          Go to settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Repositories</h1>
        {canManage && (
          <button
            type="button"
            onClick={() => setIsImporting((prev) => !prev)}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            {isImporting ? "Cancel" : "Import repositories"}
          </button>
        )}
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {isImporting && (
        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Available repositories</h2>
          {isLoadingAvailable && <p className="text-sm text-gray-500">Loading...</p>}
          <ul className="divide-y divide-gray-100">
            {availableRepos?.map((repo) => (
              <li key={repo.githubRepoId} className="flex items-center justify-between py-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    disabled={repo.alreadyImported}
                    checked={selectedRepoIds.includes(repo.githubRepoId)}
                    onChange={() => toggleSelected(repo.githubRepoId)}
                  />
                  <div>
                    <p className="text-sm text-gray-900">{repo.fullName}</p>
                    <p className="text-xs text-gray-500">{repo.description ?? "No description"}</p>
                  </div>
                </label>
                {repo.alreadyImported && <span className="text-xs text-gray-400">Already imported</span>}
              </li>
            ))}
          </ul>
          {availableRepos && availableRepos.length === 0 && (
            <p className="text-sm text-gray-500">No repositories available for this installation.</p>
          )}
          {availableRepos && availableRepos.length > 0 && (
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedRepoIds.length === 0 || importRepositories.isPending}
              className="mt-3 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {importRepositories.isPending ? "Importing..." : `Import ${selectedRepoIds.length || ""} selected`}
            </button>
          )}
        </section>
      )}

      <section className="rounded border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4">
          <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search repositories..."
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              type="text"
              value={languageInput}
              onChange={(event) => setLanguageInput(event.target.value)}
              placeholder="Language..."
              className="w-32 rounded border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              Filter
            </button>
          </form>
          <select
            value={filters.sort ?? ""}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                sort: (event.target.value || undefined) as ListRepositoriesFilters["sort"],
              }))
            }
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">Recently imported</option>
            <option value="name">Name</option>
            <option value="stars">Most stars</option>
            <option value="updated">Recently pushed</option>
          </select>
        </div>

        {isLoading && <p className="p-4 text-sm text-gray-500">Loading...</p>}
        {!isLoading && repositories && repositories.length === 0 && (
          <p className="p-4 text-sm text-gray-500">No repositories imported yet.</p>
        )}

        <ul className="divide-y divide-gray-100">
          {repositories?.map((repo) => (
            <li key={repo.id} className="flex items-center justify-between p-4">
              <button type="button" onClick={() => navigate(`/app/${orgSlug}/repositories/${repo.id}`)} className="text-left">
                <p className="text-sm font-medium text-gray-900">{repo.fullName}</p>
                <p className="text-xs text-gray-500">
                  {repo.primaryLanguage ?? "—"} · {repo.starsCount} stars · {repo.description ?? "No description"}
                </p>
              </button>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${SYNC_STATUS_STYLES[repo.syncStatus] ?? "bg-gray-100 text-gray-600"}`}
                >
                  {repo.syncStatus}
                </span>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSync(repo.id)}
                      disabled={syncRepository.isPending}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Sync
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(repo.id, repo.fullName)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
