import { Plug, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { useIntegrations, useRemoveIntegration } from "@/hooks/useProduction";
import type { IntegrationStatus } from "@/types/production.types";
import { CreateIntegrationDialog } from "./CreateIntegrationDialog";

const STATUS_TONE: Record<IntegrationStatus, StatusTone> = {
  ACTIVE: "success",
  DISABLED: "neutral",
  ERROR: "danger",
};

export function IntegrationsTab({ orgSlug, canManage }: { orgSlug: string; canManage: boolean }) {
  const { data: integrations, isLoading, isError, refetch } = useIntegrations(orgSlug);
  const removeIntegration = useRemoveIntegration(orgSlug);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> Connect integration
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {isError && <ErrorState message="Failed to load integrations." onRetry={() => refetch()} />}
      {!isLoading && !isError && integrations?.length === 0 && (
        <EmptyState icon={Plug} title="No integrations connected" description="Connect Prometheus or GitHub Actions to start collecting real production signals." />
      )}
      {!isLoading && !isError && integrations && integrations.length > 0 && (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {integrations.map((integration) => (
              <li key={integration.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{integration.name}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {integration.provider.replace("_", " ")}
                    </Badge>
                    <StatusBadge tone={STATUS_TONE[integration.status]}>{integration.status.toLowerCase()}</StatusBadge>
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {integration.id}
                    {integration.hasCredential && " · credential configured"}
                  </p>
                </div>
                {canManage && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (window.confirm(`Remove "${integration.name}"?`)) removeIntegration.mutate(integration.id);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CreateIntegrationDialog orgSlug={orgSlug} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
