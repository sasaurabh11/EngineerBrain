import { useAuth } from "@clerk/clerk-react";
import { useEffect } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { tokenProvider } from "./api/axiosClient";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { AcceptInvitationPage } from "./pages/organizations/AcceptInvitationPage";
import { SignInPage } from "./pages/auth/SignInPage";
import { SignUpPage } from "./pages/auth/SignUpPage";
import { DashboardPage } from "./pages/dashboard/DashboardPage";
import { MembersPage } from "./pages/organizations/MembersPage";
import { OrganizationSettingsPage } from "./pages/organizations/OrganizationSettingsPage";
import { OrganizationsListPage } from "./pages/organizations/OrganizationsListPage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { ProtectedRoute } from "./routes/ProtectedRoute";

function ClerkAxiosBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    tokenProvider.getToken = getToken;
  }, [getToken]);

  return null;
}

function OrgRootRedirect() {
  const { orgSlug } = useParams();
  return <Navigate to={`/app/${orgSlug}/dashboard`} replace />;
}

function App() {
  return (
    <>
      <ClerkAxiosBridge />
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/sign-in/*" element={<SignInPage />} />
          <Route path="/sign-up/*" element={<SignUpPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/organizations" replace />} />
          <Route path="/app/:orgSlug" element={<OrgRootRedirect />} />
          <Route path="/invite/:token" element={<AcceptInvitationPage />} />

          <Route element={<AppLayout />}>
            <Route path="/organizations" element={<OrganizationsListPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/app/:orgSlug/dashboard" element={<DashboardPage />} />
            <Route path="/app/:orgSlug/members" element={<MembersPage />} />
            <Route path="/app/:orgSlug/settings" element={<OrganizationSettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
