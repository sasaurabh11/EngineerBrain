import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function ViewAllLink({ to, className }: { to: string; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "group/view-all inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline",
        className,
      )}
    >
      View all
      <ArrowRight className="size-3 transition-transform group-hover/view-all:translate-x-0.5" />
    </Link>
  );
}
