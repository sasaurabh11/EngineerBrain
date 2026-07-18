import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  /** Extra action rendered alongside "Try again" - e.g. a link to a settings page. */
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, action, className }: ErrorStateProps) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {(onRetry || action) && (
          <div className="flex items-center gap-2">
            {onRetry && (
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
