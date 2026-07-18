import { cn } from "@/lib/utils";

interface LedgerEntry {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
  location: string;
  message: string;
}

const ENTRIES: LedgerEntry[] = [
  { severity: "CRITICAL", location: "src/services/paymentWebhook.ts:142", message: "Webhook signature accepted before the charge is confirmed" },
  { severity: "HIGH", location: "src/lib/auth/session.ts:58", message: "Session token never rotates after a privilege change" },
  { severity: "MEDIUM", location: "src/routes/api/orders.ts:211", message: "N+1 query fetching line items inside a loop" },
  { severity: "MEDIUM", location: "src/services/billing.ts:77", message: "Circular dependency: billing.ts → invoices.ts → billing.ts" },
  { severity: "INFO", location: "next.config.js, next.config.mjs", message: "Two config files present; only one is ever read" },
];

const SEVERITY_CLASS: Record<LedgerEntry["severity"], string> = {
  CRITICAL: "text-destructive",
  HIGH: "text-destructive",
  MEDIUM: "text-warning",
  INFO: "text-muted-foreground",
};

/** The hero's centerpiece - a typeset specimen of what the product actually
 * produces (a findings printout), not a screenshot of the app. Illustrative
 * sample data, labeled as such in the header row. */
export function AnalysisLedger() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">engineerbrain analyze · sample output</span>
        <span className="font-mono text-[11px] text-muted-foreground">5 findings</span>
      </div>
      <ul className="divide-y divide-border font-mono text-[13px]">
        {ENTRIES.map((entry, i) => (
          <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-3">
            <span className={cn("w-16 shrink-0 font-semibold", SEVERITY_CLASS[entry.severity])}>{entry.severity}</span>
            <span className="shrink-0 text-muted-foreground sm:w-64">{entry.location}</span>
            <span className="text-foreground">{entry.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
