import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { ViewAllLink } from "@/components/view-all-link";
import { useDeployments, useIncidents, useServices } from "@/hooks/useProduction";
import type { IncidentSeverity, IncidentStatus } from "@/types/production.types";

const SEVERITY_TONE: Record<IncidentSeverity, StatusTone> = { LOW: "neutral", MEDIUM: "warning", HIGH: "danger", CRITICAL: "danger" };
const ACTIVE_STATUSES: IncidentStatus[] = ["DETECTED", "INVESTIGATING"];

export function OverviewTab({ orgSlug }: { orgSlug: string }) {
  const { data: incidents, isLoading: incidentsLoading } = useIncidents(orgSlug, { page: 1, pageSize: 50 });
  const { data: services, isLoading: servicesLoading } = useServices(orgSlug);
  const { data: deployments, isLoading: deploymentsLoading } = useDeployments(orgSlug, { page: 1, pageSize: 5 });

  const activeIncidents = incidents?.items.filter((i) => ACTIVE_STATUSES.includes(i.status)) ?? [];
  const criticalCount = incidents?.items.filter((i) => i.severity === "CRITICAL" && ACTIVE_STATUSES.includes(i.status)).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Active incidents</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{incidentsLoading ? "–" : activeIncidents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Critical &amp; unresolved</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${criticalCount > 0 ? "text-destructive" : "text-foreground"}`}>
              {incidentsLoading ? "–" : criticalCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">Registered services</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{servicesLoading ? "–" : (services?.length ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Active incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {incidentsLoading && (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}
            {!incidentsLoading && activeIncidents.length === 0 && <p className="py-2 text-sm text-muted-foreground">No active incidents.</p>}
            {!incidentsLoading && activeIncidents.length > 0 && (
              <div className="space-y-0.5">
                {activeIncidents.slice(0, 5).map((incident) => (
                  <Link
                    key={incident.id}
                    to={`/app/${orgSlug}/production/incidents/${incident.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <StatusBadge tone={SEVERITY_TONE[incident.severity]} pulse className="shrink-0">
                        {incident.severity}
                      </StatusBadge>
                      <span className="truncate text-foreground">{incident.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Recent deployments</CardTitle>
            <ViewAllLink to={`/app/${orgSlug}/production`} />
          </CardHeader>
          <CardContent>
            {deploymentsLoading && (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}
            {!deploymentsLoading && deployments?.items.length === 0 && <p className="py-2 text-sm text-muted-foreground">No deployments recorded yet.</p>}
            {!deploymentsLoading && deployments && deployments.items.length > 0 && (
              <div className="space-y-0.5">
                {deployments.items.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
                    <span className="truncate font-mono text-foreground">{d.version ?? d.commitSha?.slice(0, 7) ?? d.id}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{new Date(d.deployedAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
