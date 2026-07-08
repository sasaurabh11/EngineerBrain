import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useConnectGitHub, useDisconnectGitHub, useGitHubStatus } from "../../hooks/useGithub";
import { useDeleteOrganization, useOrganization, useUpdateOrganization } from "../../hooks/useOrganizations";
import { getManageGitHubInstallationUrl } from "../../utils/github";

export function OrganizationSettingsPage() {
  const { orgSlug = "" } = useParams();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgSlug);
  const updateOrganization = useUpdateOrganization(orgSlug);
  const deleteOrganization = useDeleteOrganization();

  const [searchParams, setSearchParams] = useSearchParams();
  const githubCallbackResult = searchParams.get("github");
  const { data: githubStatus, isLoading: isGithubLoading } = useGitHubStatus(orgSlug);
  const connectGitHub = useConnectGitHub(orgSlug);
  const disconnectGitHub = useDisconnectGitHub(orgSlug);
  const [githubError, setGithubError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name);
      setDescription(organization.description ?? "");
      setLogoUrl(organization.logoUrl ?? "");
    }
  }, [organization]);

  const canEdit = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const canDelete = organization?.role === "OWNER";

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await updateOrganization.mutateAsync({
        name,
        description: description || null,
        logoUrl: logoUrl || null,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${organization?.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrganization.mutateAsync(orgSlug);
      navigate("/organizations", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete organization");
    }
  }

  async function handleConnectGitHub() {
    setGithubError(null);
    try {
      const { url } = await connectGitHub.mutateAsync();
      window.location.href = url;
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : "Failed to start GitHub connection");
    }
  }

  async function handleDisconnectGitHub() {
    if (!window.confirm("Disconnect GitHub? Imported repositories will stop syncing until reconnected.")) {
      return;
    }
    setGithubError(null);
    try {
      await disconnectGitHub.mutateAsync();
    } catch (err) {
      setGithubError(err instanceof Error ? err.message : "Failed to disconnect GitHub");
    }
  }

  function dismissGithubCallbackBanner() {
    const next = new URLSearchParams(searchParams);
    next.delete("github");
    setSearchParams(next, { replace: true });
  }

  if (!organization) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      {githubCallbackResult === "connected" && (
        <div className="flex items-center justify-between rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <span>GitHub connected successfully.</span>
          <button type="button" onClick={dismissGithubCallbackBanner} className="text-green-700 hover:text-green-900">
            Dismiss
          </button>
        </div>
      )}
      {githubCallbackResult === "error" && (
        <div className="flex items-center justify-between rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>Something went wrong connecting GitHub. Please try again.</span>
          <button type="button" onClick={dismissGithubCallbackBanner} className="text-red-700 hover:text-red-900">
            Dismiss
          </button>
        </div>
      )}

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Organization settings</h2>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="settings-name">
              Name
            </label>
            <input
              id="settings-name"
              type="text"
              required
              disabled={!canEdit}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="settings-description">
              Description
            </label>
            <textarea
              id="settings-description"
              disabled={!canEdit}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-50"
              rows={3}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="settings-logo">
              Logo URL
            </label>
            <input
              id="settings-logo"
              type="url"
              disabled={!canEdit}
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm disabled:bg-gray-50"
              placeholder="https://..."
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-600">Saved.</p>}
          {canEdit && (
            <button
              type="submit"
              disabled={updateOrganization.isPending}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {updateOrganization.isPending ? "Saving..." : "Save changes"}
            </button>
          )}
        </form>
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">GitHub integration</h2>
        {isGithubLoading && <p className="text-sm text-gray-500">Loading...</p>}
        {githubError && <p className="mb-3 text-sm text-red-600">{githubError}</p>}

        {!isGithubLoading && githubStatus?.connected && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-900">
                Connected to <span className="font-medium">{githubStatus.accountLogin}</span>
              </p>
              <p className="text-xs text-gray-500">
                {githubStatus.accountType === "ORGANIZATION" ? "Organization" : "User"} account
                {githubStatus.connectedAt && ` · connected ${new Date(githubStatus.connectedAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {getManageGitHubInstallationUrl(githubStatus) && (
                <a
                  href={getManageGitHubInstallationUrl(githubStatus)!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Manage repository access ↗
                </a>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={handleDisconnectGitHub}
                  disabled={disconnectGitHub.isPending}
                  className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {disconnectGitHub.isPending ? "Disconnecting..." : "Disconnect"}
                </button>
              )}
            </div>
          </div>
        )}

        {!isGithubLoading && !githubStatus?.connected && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {githubStatus?.status === "UNINSTALLED" ? "GitHub was disconnected." : "Not connected yet."}
            </p>
            {canEdit && (
              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={connectGitHub.isPending}
                className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {connectGitHub.isPending ? "Connecting..." : "Connect GitHub"}
              </button>
            )}
          </div>
        )}
      </section>

      {canDelete && (
        <section className="rounded border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-800">Danger zone</h2>
          <p className="mb-3 text-xs text-red-700">
            Deleting an organization removes access for all members. This cannot be undone.
          </p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteOrganization.isPending}
            className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            Delete organization
          </button>
        </section>
      )}
    </div>
  );
}
