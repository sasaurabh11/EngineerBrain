import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useConversation } from "../../hooks/useAi";
import { useIncident } from "../../hooks/useProduction";
import { useRepository } from "../../hooks/useRepositories";
import { useTask } from "../../hooks/useTasks";
import { PRIMARY_NAV, WORKSPACE_NAV } from "./nav-items";

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  repositories: "Repositories",
  production: "Production",
  ai: "AI Chat",
  tasks: "Agent Tasks",
  members: "Members",
  mcp: "MCP",
  settings: "Settings",
};

interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ orgSlug }: { orgSlug: string }) {
  const params = useParams();
  const { data: repository } = useRepository(orgSlug, params.repositoryId);
  const { data: task } = useTask(orgSlug, params.taskId);
  const { data: conversation } = useConversation(orgSlug, params.conversationId);
  const { data: incident } = useIncident(orgSlug, params.incidentId);

  const section = window.location.pathname.replace(`/app/${orgSlug}/`, "").split("/")[0];
  const sectionLabel = SECTION_LABELS[section ?? ""] ?? [...PRIMARY_NAV, ...WORKSPACE_NAV].find((n) => n.path(orgSlug).endsWith(`/${section}`))?.label;

  const crumbs: Crumb[] = [];
  if (sectionLabel) {
    crumbs.push({ label: sectionLabel, to: section ? `/app/${orgSlug}/${section}` : undefined });
  }
  if (params.repositoryId) {
    crumbs.push({ label: repository?.name ?? "…" });
  }
  if (params.taskId) {
    crumbs.push({ label: task?.goal ?? "…" });
  }
  if (params.conversationId) {
    crumbs.push({ label: conversation?.title ?? conversation?.repositoryName ?? "Conversation" });
  }
  if (params.incidentId) {
    crumbs.push({ label: incident?.title ?? "…" });
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={index} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            {crumb.to && !isLast ? (
              <Link to={crumb.to} className="text-muted-foreground hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? "truncate font-medium text-foreground" : "text-muted-foreground"}>{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
