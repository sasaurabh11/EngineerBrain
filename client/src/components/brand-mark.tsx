import { cn } from "@/lib/utils";

export function BrandMark({ collapsed, className }: { collapsed?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold text-foreground", className)}>
      <img src="/logo-2.png" alt="" className="size-7 shrink-0 rounded-lg object-contain" />
      {!collapsed && <span className="truncate">EngineerBrain</span>}
    </span>
  );
}
