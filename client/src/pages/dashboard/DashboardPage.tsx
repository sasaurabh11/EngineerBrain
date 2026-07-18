import { Bot, FolderGit2, MessageSquare, Sparkles, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { ScorePill } from "@/components/score-pill";
import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { ViewAllLink } from "@/components/view-all-link";
import { useLatestAnalysis } from "../../hooks/useAnalysis";
import { useConversations } from "../../hooks/useAi";
import { useMembers } from "../../hooks/useMembers";
import { useMe } from "../../hooks/useMe";
import { useOrganization } from "../../hooks/useOrganizations";
import { useRepositories } from "../../hooks/useRepositories";
import { useTaskList } from "../../hooks/useTasks";
import type { TaskStatus } from "../../types/task.types";

const TASK_STATUS_TONE: Record<TaskStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "info",
  PENDING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};

function RepoHealthRow({ orgSlug, repositoryId, name }: { orgSlug: string; repositoryId: string; name: string }) {
  const { data: analysis, isLoading } = useLatestAnalysis(orgSlug, repositoryId, true);

  return (
    <Link
      to={`/app/${orgSlug}/repositories/${repositoryId}`}
      className="group relative flex items-center justify-between gap-3 rounded-md py-2 pr-2 pl-3 text-sm transition-colors hover:bg-accent"
    >
      <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
      <span className="flex min-w-0 items-center gap-2">
        <FolderGit2 className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">{name}</span>
      </span>
      {isLoading ? <Skeleton className="h-4 w-8" /> : <ScorePill score={analysis?.overallScore ?? null} size="sm" />}
    </Link>
  );
}

export function DashboardPage() {
  const { orgSlug = "" } = useParams();
  const { data: me } = useMe();
  const { data: organization } = useOrganization(orgSlug);
  const { data: members, isLoading: isLoadingMembers } = useMembers(orgSlug);
  const { data: repositories, isLoading: isLoadingRepositories } = useRepositories(orgSlug, {});
  const { data: taskPage, isLoading: isLoadingTasks } = useTaskList(orgSlug);
  const { data: conversations, isLoading: isLoadingConversations } = useConversations(orgSlug);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <span className="font-mono text-[11px] tracking-wide text-primary uppercase">{orgSlug}</span>
          <h1 className="mt-0.5 text-xl font-semibold text-foreground">{organization?.name ?? "Dashboard"}</h1>
          <p className="text-sm text-muted-foreground">Welcome back{me ? `, ${me.name.split(" ")[0]}` : ""}.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/${orgSlug}/ai`}>
              <Sparkles /> New chat
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/app/${orgSlug}/tasks`}>
              <Bot /> Run agent task
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Repository overview</CardTitle>
            <ViewAllLink to={`/app/${orgSlug}/repositories`} />
          </CardHeader>
          <CardContent>
            {isLoadingRepositories ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : repositories && repositories.length > 0 ? (
              <div className="space-y-0.5">
                {repositories.slice(0, 5).map((repo) => (
                  <RepoHealthRow key={repo.id} orgSlug={orgSlug} repositoryId={repo.id} name={repo.name} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FolderGit2}
                title="No repositories yet"
                description="Import a repository from GitHub to start analyzing it."
                action={
                  <Button asChild size="sm">
                    <Link to={`/app/${orgSlug}/repositories`}>Import repository</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {me && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={me.profileImage ?? undefined} alt={me.name} />
                  <AvatarFallback>{me.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{me.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{me.email}</p>
                </div>
              </div>
            )}
            {organization && (
              <div className="border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Your role</span>
                  <Badge variant="secondary">{organization.role}</Badge>
                </div>
                <Link to={`/app/${orgSlug}/settings`} className="mt-2 inline-block text-xs text-primary hover:underline">
                  Organization settings →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "80ms" }}>
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b border-border pb-3">
            <CardTitle className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Recent agent tasks</CardTitle>
            <ViewAllLink to={`/app/${orgSlug}/tasks`} />
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <div className="space-y-2">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : taskPage && taskPage.items.length > 0 ? (
              <div className="space-y-0.5">
                {taskPage.items.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/${orgSlug}/tasks/${task.id}`}
                    className="group relative flex items-center justify-between gap-2 rounded-md py-2 pr-2 pl-3 transition-colors hover:bg-accent"
                  >
                    <span className="absolute top-1 bottom-1 left-0 w-0.5 scale-y-0 rounded-full bg-primary transition-transform duration-200 group-hover:scale-y-100" />
                    <span className="truncate text-sm text-foreground">{task.goal}</span>
                    <StatusBadge tone={TASK_STATUS_TONE[task.status]} pulse={task.status === "RUNNING"} className="shrink-0">
                      {task.status.replace("_", " ").toLowerCase()}
                    </StatusBadge>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={Bot} title="No agent tasks yet" description="Run a workflow to review a PR, triage an issue, or audit a repository." />
            )}
          </CardContent>
        </Card>

        <Card className="divide-y divide-border py-0">
          <div className="p-(--card-spacing)">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Conversations</span>
              <ViewAllLink to={`/app/${orgSlug}/ai`} />
            </div>
            {isLoadingConversations ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-0.5">
                {conversations.slice(0, 3).map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/${orgSlug}/ai/${c.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{c.title ?? c.repositoryName ?? "New conversation"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={MessageSquare} title="No conversations yet" />
            )}
          </div>

          <div className="p-(--card-spacing)">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Members</span>
              <ViewAllLink to={`/app/${orgSlug}/members`} />
            </div>
            {isLoadingMembers ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : members && members.length > 0 ? (
              <div className="space-y-0.5">
                {members.slice(0, 3).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarFallback className="text-[10px]">{member.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm text-foreground">{member.user.name}</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Users} title="No members yet" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
