import { UserButton } from "@clerk/clerk-react";
import { Home, Menu, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { CircuitField } from "@/components/circuit-field";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Breadcrumbs } from "../components/layout/breadcrumbs";
import { CommandPalette } from "../components/layout/command-palette";
import { OrgSwitcher } from "../components/layout/org-switcher";
import { Sidebar, useSidebarCollapsed } from "../components/layout/sidebar";
import { SidebarNav } from "../components/layout/sidebar-nav";
import { ThemeToggle } from "../components/theme-toggle";
import { useMyInvitations } from "../hooks/useInvitations";

export function AppLayout() {
  const { orgSlug } = useParams();
  const { data: invitations } = useMyInvitations();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCommandOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!orgSlug) {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        <CircuitField
          density={0.7}
          className="pointer-events-none absolute inset-0 opacity-[0.28] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent_75%)] dark:opacity-[0.18]"
        />
        <header className="relative flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border px-3 md:px-5">
          <Link to="/">
            <BrandMark />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {invitations && invitations.length > 0 && (
              <Link to="/organizations">
                <Badge variant="destructive" className="cursor-pointer">
                  {invitations.length} invitation{invitations.length > 1 ? "s" : ""}
                </Badge>
              </Link>
            )}
            <ThemeToggle />
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </Link>
            <UserButton />
          </div>
        </header>
        <main className="relative flex-1 p-4 md:p-6">
          <PageTransition />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar orgSlug={orgSlug} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="gap-3 border-b border-sidebar-border p-2.5">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Link to="/" onClick={() => setMobileNavOpen(false)}>
              <BrandMark />
            </Link>
            <OrgSwitcher orgSlug={orgSlug} />
          </SheetHeader>
          <SidebarNav orgSlug={orgSlug} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-13 shrink-0 items-center justify-between gap-3 border-b border-border px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
              <Menu className="size-4" />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" className="hidden md:inline-flex">
                  <Link to="/" aria-label="Go to EngineerBrain home">
                    <Home className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Home</TooltipContent>
            </Tooltip>
            <Breadcrumbs orgSlug={orgSlug} />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:flex" onClick={() => setCommandOpen(true)}>
              <Search className="size-3.5" />
              Search
              <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </Button>
            {invitations && invitations.length > 0 && (
              <Link to="/organizations">
                <Badge variant="destructive" className="cursor-pointer">
                  {invitations.length} invitation{invitations.length > 1 ? "s" : ""}
                </Badge>
              </Link>
            )}
            <ThemeToggle />
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </Link>
            <UserButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageTransition />
        </main>
      </div>

      <CommandPalette orgSlug={orgSlug} open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
