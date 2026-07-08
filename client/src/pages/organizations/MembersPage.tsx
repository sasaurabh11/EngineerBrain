import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
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
    <button type="button" onClick={handleCopy} className="text-xs font-medium text-gray-500 hover:text-gray-900">
      {copied ? "Copied!" : "Copy invite link"}
    </button>
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
      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Members</h2>
        {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
        {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
        <ul className="divide-y divide-gray-100">
          {members?.map((member) => (
            <li key={member.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                <p className="text-xs text-gray-500">{member.user.email}</p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(event) => handleRoleChange(member.id, event.target.value as OrgRole)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleRemove(member.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {member.role}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Invite a member</h2>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="invite-email">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                placeholder="teammate@example.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as OrgRole)}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={createInvitation.isPending}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {createInvitation.isPending ? "Sending..." : "Send invite"}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}

          {invitations && invitations.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold text-gray-500 uppercase">Pending invitations</h3>
              <ul className="divide-y divide-gray-100">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm text-gray-900">{invitation.email}</p>
                      <p className="text-xs text-gray-500">
                        {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <InviteLinkButton token={invitation.token} />
                      <button
                        type="button"
                        onClick={() => revokeInvitation.mutate(invitation.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
