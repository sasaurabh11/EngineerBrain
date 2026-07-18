import { Plus, Server } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useServiceHealth, useServices } from "@/hooks/useProduction";
import { CreateServiceDialog } from "./CreateServiceDialog";

function ServiceHealthCell({ orgSlug, serviceId }: { orgSlug: string; serviceId: string }) {
  const { data: health, isLoading } = useServiceHealth(orgSlug, serviceId);

  if (isLoading) return <Skeleton className="h-4 w-24" />;
  if (!health || (health.errorRate === null && health.p95LatencyMs === null)) {
    return <span className="text-xs text-muted-foreground">{health?.message ?? "No data yet"}</span>;
  }

  return (
    <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
      {health.errorRate !== null && <span className="text-muted-foreground">err {(health.errorRate * 100).toFixed(2)}%</span>}
      {health.p95LatencyMs !== null && <span className="text-muted-foreground">p95 {Math.round(health.p95LatencyMs)}ms</span>}
      {health.source && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{health.source}</span>}
    </div>
  );
}

export function ServicesTab({ orgSlug }: { orgSlug: string }) {
  const { data: services, isLoading, isError, refetch } = useServices(orgSlug);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> Register service
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {isError && <ErrorState message="Failed to load services." onRetry={() => refetch()} />}
      {!isLoading && !isError && services?.length === 0 && (
        <EmptyState icon={Server} title="No services registered" description="Register a service so alerts and deployments can be matched to it." />
      )}
      {!isLoading && !isError && services && services.length > 0 && (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {services.map((service) => (
              <li key={service.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{service.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {service.criticality}
                    </Badge>
                    {!service.repositoryId && <span className="text-xs text-muted-foreground">No linked repository</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  <ServiceHealthCell orgSlug={orgSlug} serviceId={service.id} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <CreateServiceDialog orgSlug={orgSlug} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
