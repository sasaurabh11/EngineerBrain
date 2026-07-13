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
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
    >
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
  const { data: members } = useMembers(orgSlug);
  const { data: repositories } = useRepositories(orgSlug, {});
  const { data: taskPage } = useTaskList(orgSlug);
  const { data: conversations } = useConversations(orgSlug);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{organization?.name ?? "Dashboard"}</h1>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Repository overview</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/${orgSlug}/repositories`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {repositories && repositories.length > 0 ? (
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
          <CardHeader>
            <CardTitle className="text-sm font-medium">Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {me && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={me.profileImage ?? undefined} />
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent agent tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/${orgSlug}/tasks`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {taskPage && taskPage.items.length > 0 ? (
              <div className="space-y-0.5">
                {taskPage.items.slice(0, 5).map((task) => (
                  <Link
                    key={task.id}
                    to={`/app/${orgSlug}/tasks/${task.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-accent"
                  >
                    <span className="truncate text-sm text-foreground">{task.goal}</span>
                    <StatusBadge tone={TASK_STATUS_TONE[task.status]} className="shrink-0">
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

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent conversations</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/${orgSlug}/ai`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {conversations && conversations.length > 0 ? (
              <div className="space-y-0.5">
                {conversations.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    to={`/app/${orgSlug}/ai/${c.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-foreground">{c.title ?? c.repositoryName ?? "New conversation"}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState icon={MessageSquare} title="No conversations yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Organization members</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/app/${orgSlug}/members`}>View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {members && members.length > 0 ? (
              <div className="space-y-0.5">
                {members.slice(0, 5).map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 px-2 py-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-6">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
