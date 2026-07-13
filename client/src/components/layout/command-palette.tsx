import { FolderGit2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRepositories } from "../../hooks/useRepositories";
import { PRIMARY_NAV, WORKSPACE_NAV } from "./nav-items";

interface CommandPaletteProps {
  orgSlug: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ orgSlug, open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { data: repositories } = useRepositories(orgSlug, {});

  function go(path: string) {
    navigate(path);
    onOpenChange(false);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command palette" description="Jump to a page or repository">
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {[...PRIMARY_NAV, ...WORKSPACE_NAV].map((item) => (
            <CommandItem key={item.label} onSelect={() => go(item.path(orgSlug))}>
              <item.icon className="size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {repositories && repositories.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Repositories">
              {repositories.map((repo) => (
                <CommandItem key={repo.id} onSelect={() => go(`/app/${orgSlug}/repositories/${repo.id}`)}>
                  <FolderGit2 className="size-4" />
                  {repo.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
