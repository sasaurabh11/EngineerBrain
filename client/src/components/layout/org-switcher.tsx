import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrganizations } from "../../hooks/useOrganizations";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function OrgSwitcher({ orgSlug, collapsed }: { orgSlug: string; collapsed?: boolean }) {
  const { data: organizations } = useOrganizations();
  const navigate = useNavigate();
  const current = organizations?.find((org) => org.slug === orgSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md p-1.5 text-left hover:bg-sidebar-accent"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
            {current ? initials(current.name) : "…"}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-sidebar-foreground">{current?.name ?? "Loading…"}</span>
                <span className="block truncate text-xs text-muted-foreground">{current?.role ?? ""}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations?.map((org) => (
          <DropdownMenuItem key={org.slug} onSelect={() => navigate(`/app/${org.slug}/dashboard`)}>
            <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {initials(org.name)}
            </span>
            <span className="flex-1 truncate">{org.name}</span>
            {org.slug === orgSlug && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/organizations")}>
          <Plus className="size-4" />
          All organizations
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
