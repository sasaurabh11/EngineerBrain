import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRIMARY_NAV, WORKSPACE_NAV, type NavItem } from "./nav-items";

function NavRow({ item, orgSlug, collapsed, onNavigate }: { item: NavItem; orgSlug: string; collapsed?: boolean; onNavigate?: () => void }) {
  const link = (
    <NavLink
      to={item.path(orgSlug)}
      onClick={onNavigate}
      end={item.label === "Dashboard"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
          collapsed && "justify-center px-0",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({ orgSlug, collapsed, onNavigate }: { orgSlug: string; collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
      <div className="space-y-0.5">
        {PRIMARY_NAV.map((item) => (
          <NavRow key={item.label} item={item} orgSlug={orgSlug} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="space-y-0.5">
        {!collapsed && <p className="px-2 pb-1 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">Workspace</p>}
        {WORKSPACE_NAV.map((item) => (
          <NavRow key={item.label} item={item} orgSlug={orgSlug} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}
