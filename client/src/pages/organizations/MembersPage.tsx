import { Check, Copy, Loader2, Mail, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateInvitation, useInvitations, useRevokeInvitation } from "../../hooks/useInvitations";
import { useMembers, useRemoveMember, useUpdateMemberRole } from "../../hooks/useMembers";
import { useOrganization } from "../../hooks/useOrganizations";
import type { OrgRole } from "../../types/organization.types";

const ROLES: OrgRole[] = ["OWNER", "ADMIN", "MANAGER", "DEVELOPER", "QA", "VIEWER"];

function InviteLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleCopy}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {copied ? "Copied" : "Copy invite link"}
    </Button>
  );
}

export function MembersPage() {
  const { orgSlug = "" } = useParams();
  const { data: organization } = useOrganization(orgSlug);
  const { data: members, isLoading } = useMembers(orgSlug);
  const updateRole = useUpdateMemberRole(orgSlug);
  const removeMember = useRemoveMember(orgSlug);

  const { data: invitations } = useInvitations(orgSlug);
  const createInvitation = useCreateInvitation(orgSlug);
  const revokeInvitation = useRevokeInvitation(orgSlug);

  const canManage = organization?.role === "OWNER" || organization?.role === "ADMIN";

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("VIEWER");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    try {
      await createInvitation.mutateAsync({ email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setInviteRole("VIEWER");
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    }
  }

  async function handleRoleChange(memberId: string, role: OrgRole) {
    setActionError(null);
    try {
      await updateRole.mutateAsync({ memberId, role });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  async function handleRemove(memberId: string) {
    setActionError(null);
    try {
      await removeMember.mutateAsync(memberId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Members</CardTitle>
        </CardHeader>
        <CardContent>
          {actionError && <p className="mb-3 text-sm text-destructive">{actionError}</p>}
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}
          {members && members.length === 0 && <EmptyState icon={Users} title="No members yet" />}
          <ul className="divide-y divide-border">
            {members?.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback>{member.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{member.user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Select value={member.role} onValueChange={(role) => handleRoleChange(member.id, role as OrgRole)}>
                      <SelectTrigger size="sm" className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemove(member.id)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    {member.role}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Invite a member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-email">
                  Email
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="w-64"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="invite-role">
                  Role
                </label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                  <SelectTrigger id="invite-role" className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createInvitation.isPending}>
                {createInvitation.isPending && <Loader2 className="animate-spin" />}
                Send invite
              </Button>
            </form>
            {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}

            {invitations && invitations.length > 0 && (
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Pending invitations</h3>
                <ul className="divide-y divide-border">
                  {invitations.map((invitation) => (
                    <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{invitation.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <InviteLinkButton token={invitation.token} />
                        <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeInvitation.mutate(invitation.id)}>
                          Revoke
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
