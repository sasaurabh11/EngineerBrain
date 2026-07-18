import { Building2, Loader2, Mail, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from "../../hooks/useInvitations";
import { useCreateOrganization, useOrganizations } from "../../hooks/useOrganizations";

export function OrganizationsListPage() {
  const { data: organizations, isLoading } = useOrganizations();
  const createOrganization = useCreateOrganization();
  const navigate = useNavigate();

  const { data: invitations } = useMyInvitations();
  const acceptInvitation = useAcceptInvitation();
  const declineInvitation = useDeclineInvitation();
  const [invitationError, setInvitationError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const organization = await createOrganization.mutateAsync({ name });
      setName("");
      setIsCreating(false);
      navigate(`/app/${organization.slug}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    }
  }

  async function handleAcceptInvitation(invitationId: string, orgSlug: string) {
    setInvitationError(null);
    try {
      await acceptInvitation.mutateAsync(invitationId);
      navigate(`/app/${orgSlug}/dashboard`);
    } catch (err) {
      setInvitationError(err instanceof Error ? err.message : "Failed to accept invitation");
    }
  }

  async function handleDeclineInvitation(invitationId: string) {
    setInvitationError(null);
    try {
      await declineInvitation.mutateAsync(invitationId);
    } catch (err) {
      setInvitationError(err instanceof Error ? err.message : "Failed to decline invitation");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-fade-up">
      {invitations && invitations.length > 0 && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <Mail className="size-4" /> Pending invitations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitationError && <p className="mb-3 text-sm text-destructive">{invitationError}</p>}
            <ul className="divide-y divide-border">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{invitation.organization.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invitation.invitedBy.name} as {invitation.role}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation.id, invitation.organization.slug)}
                      disabled={acceptInvitation.isPending}
                    >
                      Accept
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      disabled={declineInvitation.isPending}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Your organizations</h1>
          <Button type="button" onClick={() => setIsCreating((prev) => !prev)} variant={isCreating ? "outline" : "default"}>
            {isCreating ? (
              "Cancel"
            ) : (
              <>
                <Plus /> New organization
              </>
            )}
          </Button>
        </div>

        {isCreating && (
          <Card className="mb-4">
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="org-name">
                    Organization name
                  </label>
                  <Input
                    id="org-name"
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Engineer Brain"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={createOrganization.isPending}>
                  {createOrganization.isPending && <Loader2 className="animate-spin" />}
                  Create organization
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {!isLoading && organizations && organizations.length === 0 && (
          <EmptyState icon={Building2} title="No organizations yet" description="Create one to get started." />
        )}

        {organizations && organizations.length > 0 && (
          <Card className="py-0">
            <ul className="divide-y divide-border">
              {organizations.map((org) => (
                <li key={org.id} className="group relative">
                  <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                  <button
                    type="button"
                    onClick={() => navigate(`/app/${org.slug}/dashboard`)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{org.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{org.slug}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {org.role}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
