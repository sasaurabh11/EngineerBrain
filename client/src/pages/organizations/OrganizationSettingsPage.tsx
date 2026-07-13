import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useConnectGitHub, useDisconnectGitHub, useGitHubStatus } from "../../hooks/useGithub";
import { useDeleteOrganization, useOrganization, useUpdateOrganization } from "../../hooks/useOrganizations";
import type { Organization } from "../../types/organization.types";
import { getManageGitHubInstallationUrl } from "../../utils/github";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.01-.02-1.99-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.67.8.56A10.99 10.99 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function OrganizationDetailsForm({ orgSlug, organization }: { orgSlug: string; organization: Organization }) {
  const updateOrganization = useUpdateOrganization(orgSlug);
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description ?? "");
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const canEdit = organization.role === "OWNER" || organization.role === "ADMIN";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Organization settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-name">
              Name
            </label>
            <Input id="settings-name" type="text" required disabled={!canEdit} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-description">
              Description
            </label>
            <Textarea
              id="settings-description"
              disabled={!canEdit}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="settings-logo">
              Logo URL
            </label>
            <Input
              id="settings-logo"
              type="url"
              disabled={!canEdit}
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-success">Saved.</p>}
          {canEdit && (
            <Button type="submit" disabled={updateOrganization.isPending}>
              {updateOrganization.isPending && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function OrganizationSettingsPage() {
  const { orgSlug = "" } = useParams();
  const navigate = useNavigate();
  const { data: organization } = useOrganization(orgSlug);
  const deleteOrganization = useDeleteOrganization();

  const [searchParams, setSearchParams] = useSearchParams();
  const githubCallbackResult = searchParams.get("github");
  const { data: githubStatus, isLoading: isGithubLoading } = useGitHubStatus(orgSlug);
  const connectGitHub = useConnectGitHub(orgSlug);
  const disconnectGitHub = useDisconnectGitHub(orgSlug);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canEdit = organization?.role === "OWNER" || organization?.role === "ADMIN";
  const canDelete = organization?.role === "OWNER";

  async function handleDelete() {
    if (!window.confirm(`Delete "${organization?.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteOrganization.mutateAsync(orgSlug);
      navigate("/organizations", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete organization");
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
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      {githubCallbackResult === "connected" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" /> GitHub connected successfully.
          </span>
          <button type="button" onClick={dismissGithubCallbackBanner} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {githubCallbackResult === "error" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <span className="flex items-center gap-2">
            <XCircle className="size-4" /> Something went wrong connecting GitHub. Please try again.
          </span>
          <button type="button" onClick={dismissGithubCallbackBanner} className="hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <OrganizationDetailsForm key={organization.id} orgSlug={orgSlug} organization={organization} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">GitHub integration</CardTitle>
        </CardHeader>
        <CardContent>
          {isGithubLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          )}
          {githubError && <p className="mb-3 text-sm text-destructive">{githubError}</p>}

          {!isGithubLoading && githubStatus?.connected && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-foreground">
                  <GitHubMark className="size-4" />
                </div>
                <div>
                  <p className="text-sm text-foreground">
                    Connected to <span className="font-medium">{githubStatus.accountLogin}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {githubStatus.accountType === "ORGANIZATION" ? "Organization" : "User"} account
                    {githubStatus.connectedAt && ` · connected ${new Date(githubStatus.connectedAt).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getManageGitHubInstallationUrl(githubStatus) && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={getManageGitHubInstallationUrl(githubStatus)!} target="_blank" rel="noreferrer">
                      Manage access <ExternalLink className="size-3" />
                    </a>
                  </Button>
                )}
                {canEdit && (
                  <Button type="button" variant="outline" size="sm" onClick={handleDisconnectGitHub} disabled={disconnectGitHub.isPending}>
                    {disconnectGitHub.isPending && <Loader2 className="animate-spin" />}
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          )}

          {!isGithubLoading && !githubStatus?.connected && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {githubStatus?.status === "UNINSTALLED" ? "GitHub was disconnected." : "Not connected yet."}
              </p>
              {canEdit && (
                <Button type="button" onClick={handleConnectGitHub} disabled={connectGitHub.isPending}>
                  {connectGitHub.isPending && <Loader2 className="animate-spin" />}
                  <GitHubMark className="size-4" /> Connect GitHub
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-destructive/80">Deleting an organization removes access for all members. This cannot be undone.</p>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
            <Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={handleDelete} disabled={deleteOrganization.isPending}>
              {deleteOrganization.isPending && <Loader2 className="animate-spin" />}
              Delete organization
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
