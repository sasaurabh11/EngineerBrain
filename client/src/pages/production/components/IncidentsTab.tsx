import { AlertTriangle, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { useIncidents } from "@/hooks/useProduction";
import type { IncidentSeverity, IncidentStatus } from "@/types/production.types";
import { DeclareIncidentDialog } from "./DeclareIncidentDialog";

const STATUS_TONE: Record<IncidentStatus, StatusTone> = {
  DETECTED: "warning",
  INVESTIGATING: "info",
  ROOT_CAUSED: "info",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const SEVERITY_TONE: Record<IncidentSeverity, StatusTone> = {
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

export function IncidentsTab({ orgSlug }: { orgSlug: string }) {
  const [status, setStatus] = useState<IncidentStatus | "all">("all");
  const [declareOpen, setDeclareOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useIncidents(orgSlug, { status: status === "all" ? undefined : status, page: 1, pageSize: 50 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as IncidentStatus | "all")}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DETECTED">Detected</SelectItem>
            <SelectItem value="INVESTIGATING">Investigating</SelectItem>
            <SelectItem value="ROOT_CAUSED">Root caused</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={() => setDeclareOpen(true)}>
          <Plus /> Declare incident
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
      {isError && <ErrorState message="Failed to load incidents." onRetry={() => refetch()} />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents"
          description="Incidents appear here once a connected alert fires, or you declare one manually."
        />
      )}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <Card className="py-0">
          <ul className="divide-y divide-border">
            {data.items.map((incident) => (
              <li key={incident.id} className="group relative">
                <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                <Link
                  to={`/app/${orgSlug}/production/incidents/${incident.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge tone={SEVERITY_TONE[incident.severity]}>{incident.severity}</StatusBadge>
                      <StatusBadge tone={STATUS_TONE[incident.status]} pulse={incident.status === "DETECTED" || incident.status === "INVESTIGATING"}>
                        {incident.status.replace("_", " ").toLowerCase()}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{incident.title}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{new Date(incident.detectedAt).toLocaleString()}</p>
                    {incident.confidenceScore !== null && <p className="tabular-nums">confidence {incident.confidenceScore}%</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DeclareIncidentDialog orgSlug={orgSlug} open={declareOpen} onOpenChange={setDeclareOpen} />
    </div>
  );
}
