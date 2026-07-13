import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "./org-switcher";
import { SidebarNav } from "./sidebar-nav";

const STORAGE_KEY = "engineerbrain-sidebar-collapsed";

// eslint-disable-next-line react-refresh/only-export-components -- small hook co-located with the one component that uses it
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(STORAGE_KEY) === "1");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}

export function Sidebar({ orgSlug, collapsed, onToggleCollapsed }: { orgSlug: string; collapsed: boolean; onToggleCollapsed: () => void }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <div className="p-2">
        <OrgSwitcher orgSlug={orgSlug} collapsed={collapsed} />
      </div>
      <SidebarNav orgSlug={orgSlug} collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        <Button variant="ghost" size="icon" className="w-full" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
