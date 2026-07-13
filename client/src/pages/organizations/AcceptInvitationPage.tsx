import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";
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
      <div className="w-full max-w-md space-y-4">
        <ErrorState title="Couldn't accept invitation" message={error} />
        <Button asChild variant="outline" className="w-full">
          <Link to="/organizations">Go to your organizations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      Accepting invitation…
    </div>
  );
}
