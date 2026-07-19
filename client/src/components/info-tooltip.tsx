import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  children: React.ReactNode;
  className?: string;
}

/** Small (i) affordance that explains a metric/score on hover/focus - the
 * shared fix for "never show unexplained numbers" across score tiles. */
export function InfoTooltip({ children, className }: InfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn("text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground", className)}
          aria-label="What does this mean?"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}
