import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface PageHelpProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** The shared "how do I use this page" affordance - a small (?) next to a
 * page's title that opens real, page-specific guidance instead of leaving
 * users to reverse-engineer functionality from the UI alone. */
export function PageHelp({ title, children, className }: PageHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How to use this page"
          className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground ${className ?? ""}`}
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-2 space-y-2 text-sm text-muted-foreground [&_a]:text-primary [&_a]:hover:underline [&_strong]:font-medium [&_strong]:text-foreground">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
