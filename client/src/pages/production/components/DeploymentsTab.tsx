import { Rocket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { useDeployments } from "@/hooks/useProduction";
import type { DeploymentStatus } from "@/types/production.types";

const STATUS_TONE: Record<DeploymentStatus, StatusTone> = {
  SUCCESS: "success",
  FAILED: "danger",
  ROLLED_BACK: "warning",
  IN_PROGRESS: "info",
};

export function DeploymentsTab({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, isError, refetch } = useDeployments(orgSlug, { page: 1, pageSize: 50 });

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {isError && <ErrorState message="Failed to load deployments." onRetry={() => refetch()} />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          icon={Rocket}
          title="No deployments yet"
          description="Register a service linked to a repository - GitHub Actions workflow runs sync automatically every 10 minutes."
        />
      )}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {data.items.map((deployment) => (
              <li key={deployment.id} className="group relative flex items-center justify-between gap-3 p-3.5 transition-colors hover:bg-accent/50">
                <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm text-foreground">{deployment.version ?? deployment.commitSha?.slice(0, 7) ?? deployment.id}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {deployment.environment} · {deployment.sourceProvider.replace("_", " ").toLowerCase()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">{new Date(deployment.deployedAt).toLocaleString()}</span>
                  <StatusBadge tone={STATUS_TONE[deployment.status]} pulse={deployment.status === "IN_PROGRESS"}>
                    {deployment.status.replace("_", " ").toLowerCase()}
                  </StatusBadge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
