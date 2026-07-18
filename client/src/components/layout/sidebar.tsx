import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { CircuitField } from "@/components/circuit-field";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
        "relative hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-150 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <CircuitField
        density={0.5}
        className="pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent_85%)] dark:opacity-[0.22]"
      />
      <div className="relative flex items-center border-b border-sidebar-border p-2.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link to="/" aria-label="Go to EngineerBrain home" className="rounded-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <BrandMark collapsed={collapsed} />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Home</TooltipContent>
        </Tooltip>
      </div>
      <div className="relative p-2">
        <OrgSwitcher orgSlug={orgSlug} collapsed={collapsed} />
      </div>
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <SidebarNav orgSlug={orgSlug} collapsed={collapsed} />
      </div>
      <div className="relative border-t border-sidebar-border p-2">
        <Button variant="ghost" size="icon" className="w-full" onClick={onToggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
    </aside>
  );
}
