import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="mx-auto max-w-2xl">
      {invitations && invitations.length > 0 && (
        <section className="mb-8 rounded border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Pending invitations</h2>
          {invitationError && <p className="mb-3 text-sm text-red-600">{invitationError}</p>}
          <ul className="divide-y divide-blue-100">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{invitation.organization.name}</p>
                  <p className="text-xs text-gray-600">
                    Invited by {invitation.invitedBy.name} as {invitation.role}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptInvitation(invitation.id, invitation.organization.slug)}
                    disabled={acceptInvitation.isPending}
                    className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclineInvitation(invitation.id)}
                    disabled={declineInvitation.isPending}
                    className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Your organizations</h1>
        <button
          type="button"
          onClick={() => setIsCreating((prev) => !prev)}
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
        >
          {isCreating ? "Cancel" : "New organization"}
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="mb-6 rounded border border-gray-200 bg-white p-4">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="org-name">
            Organization name
          </label>
          <input
            id="org-name"
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mb-3 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="Engineer Brain"
          />
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={createOrganization.isPending}
            className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            {createOrganization.isPending ? "Creating..." : "Create organization"}
          </button>
        </form>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading...</p>}

      {!isLoading && organizations && organizations.length === 0 && (
        <p className="text-sm text-gray-500">You don't belong to any organization yet. Create one to get started.</p>
      )}

      <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
        {organizations?.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              onClick={() => navigate(`/app/${org.slug}/dashboard`)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{org.name}</p>
                <p className="text-xs text-gray-500">{org.slug}</p>
              </div>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{org.role}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
