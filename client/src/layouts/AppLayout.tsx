import { UserButton } from "@clerk/clerk-react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { useMyInvitations } from "../hooks/useInvitations";
import { useOrganizations } from "../hooks/useOrganizations";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-medium text-gray-900" : "text-gray-500 hover:text-gray-900";

export function AppLayout() {
  const { orgSlug } = useParams();
  const navigate = useNavigate();
  const { data: organizations } = useOrganizations();
  const { data: invitations } = useMyInvitations();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/organizations" className="font-semibold text-gray-900">
              EngineerBrain
            </Link>

            {orgSlug && organizations && organizations.length > 0 && (
              <select
                value={orgSlug}
                onChange={(event) => navigate(`/app/${event.target.value}/dashboard`)}
                className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-700"
              >
                {organizations.map((org) => (
                  <option key={org.slug} value={org.slug}>
                    {org.name}
                  </option>
                ))}
              </select>
            )}

            {orgSlug && (
              <nav className="flex gap-4 text-sm">
                <NavLink to={`/app/${orgSlug}/dashboard`} className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to={`/app/${orgSlug}/repositories`} className={navLinkClass}>
                  Repositories
                </NavLink>
                <NavLink to={`/app/${orgSlug}/ai`} className={navLinkClass}>
                  AI Chat
                </NavLink>
                <NavLink to={`/app/${orgSlug}/members`} className={navLinkClass}>
                  Members
                </NavLink>
                <NavLink to={`/app/${orgSlug}/settings`} className={navLinkClass}>
                  Settings
                </NavLink>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {invitations && invitations.length > 0 && (
              <Link
                to="/organizations"
                className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                {invitations.length} invitation{invitations.length > 1 ? "s" : ""}
              </Link>
            )}
            <Link to="/profile" className="text-sm text-gray-500 hover:text-gray-900">
              Profile
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
