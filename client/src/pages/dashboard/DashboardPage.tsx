import { Link, useParams } from "react-router-dom";
import { useMembers } from "../../hooks/useMembers";
import { useMe } from "../../hooks/useMe";
import { useOrganization } from "../../hooks/useOrganizations";

export function DashboardPage() {
  const { orgSlug } = useParams();
  const { data: me } = useMe();
  const { data: organization } = useOrganization(orgSlug);
  const { data: members } = useMembers(orgSlug);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Your account</h2>
        {me && (
          <div className="flex items-center gap-3">
            {me.profileImage && <img src={me.profileImage} alt="" className="h-10 w-10 rounded-full" />}
            <div>
              <p className="text-sm font-medium text-gray-900">{me.name}</p>
              <p className="text-xs text-gray-500">{me.email}</p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Current organization</h2>
          <Link to={`/app/${orgSlug}/settings`} className="text-xs text-gray-500 hover:text-gray-900">
            Settings
          </Link>
        </div>
        {organization && (
          <div>
            <p className="text-sm font-medium text-gray-900">{organization.name}</p>
            <p className="text-xs text-gray-500">{organization.description ?? "No description"}</p>
            <p className="mt-2 text-xs text-gray-500">
              Your role: <span className="font-medium text-gray-700">{organization.role}</span>
            </p>
          </div>
        )}
      </section>

      <section className="rounded border border-gray-200 bg-white p-4 md:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Organization members</h2>
          <Link to={`/app/${orgSlug}/members`} className="text-xs text-gray-500 hover:text-gray-900">
            View all
          </Link>
        </div>
        <ul className="divide-y divide-gray-100">
          {members?.slice(0, 5).map((member) => (
            <li key={member.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-gray-900">{member.user.name}</p>
                <p className="text-xs text-gray-500">{member.user.email}</p>
              </div>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{member.role}</span>
            </li>
          ))}
        </ul>
        {members && members.length === 0 && <p className="text-sm text-gray-500">No members yet.</p>}
      </section>
    </div>
  );
}
