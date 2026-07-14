import { BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold text-foreground", className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <BrainCircuit className="size-4" />
      </span>
      {!collapsed && <span className="truncate">EngineerBrain</span>}
    </span>
  );
}
