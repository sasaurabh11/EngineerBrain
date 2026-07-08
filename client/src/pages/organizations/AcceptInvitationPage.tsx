import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { invitationsApi } from "../../api/invitations.api";

export function AcceptInvitationPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invitationsApi
      .accept(token)
      .then(async () => {
        await queryClient.invalidateQueries({ queryKey: ["organizations"] });
        navigate("/organizations", { replace: true });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to accept invitation");
      });
  }, [token, navigate, queryClient]);

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded border border-gray-200 bg-white p-6 text-center">
        <p className="mb-3 text-sm text-red-600">{error}</p>
        <Link to="/organizations" className="text-sm font-medium text-gray-900 underline">
          Go to your organizations
        </Link>
      </div>
    );
  }

  return <p className="text-sm text-gray-500">Accepting invitation...</p>;
}
