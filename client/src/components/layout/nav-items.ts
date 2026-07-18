import { Activity, Bot, FolderGit2, LayoutDashboard, Settings, Sparkles, Users } from "lucide-react";

export interface NavItem {
  label: string;
  path: (orgSlug: string) => string;
  icon: typeof LayoutDashboard;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", path: (org) => `/app/${org}/dashboard`, icon: LayoutDashboard },
  { label: "Repositories", path: (org) => `/app/${org}/repositories`, icon: FolderGit2 },
  { label: "Production", path: (org) => `/app/${org}/production`, icon: Activity },
  { label: "AI Chat", path: (org) => `/app/${org}/ai`, icon: Sparkles },
  { label: "Agent Tasks", path: (org) => `/app/${org}/tasks`, icon: Bot },
];

export const WORKSPACE_NAV: NavItem[] = [
  { label: "Members", path: (org) => `/app/${org}/members`, icon: Users },
  { label: "Settings", path: (org) => `/app/${org}/settings`, icon: Settings },
];
