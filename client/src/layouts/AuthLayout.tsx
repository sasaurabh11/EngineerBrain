import { Link, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { CircuitField } from "@/components/circuit-field";
import { PageTransition } from "@/components/page-transition";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnalysisLedger } from "@/pages/home/components/analysis-ledger";

const COPY = {
  "sign-in": {
    eyebrow: "Welcome back",
    headline: "Pick up exactly where the last review left off.",
  },
  "sign-up": {
    eyebrow: "Get started",
    headline: "See what's actually happening in your repositories.",
  },
};

export function AuthLayout() {
  const location = useLocation();
  const key = location.pathname.startsWith("/sign-up") ? "sign-up" : "sign-in";
  const copy = COPY[key];

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-border bg-muted/30 lg:flex lg:flex-col">
        <CircuitField density={1.1} className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.3]" />
        <div className="relative flex flex-1 flex-col justify-between p-10">
          <Link to="/">
            <BrandMark />
          </Link>
          <div className="max-w-md animate-fade-up">
            <span className="font-mono text-[11px] tracking-wide text-primary uppercase">{copy.eyebrow}</span>
            <h1 className="mt-2 text-3xl leading-[1.15] font-semibold text-balance text-foreground">{copy.headline}</h1>
          </div>
          <div className="max-w-md animate-fade-up" style={{ animationDelay: "80ms" }}>
            <AnalysisLedger />
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <header className="flex items-center justify-between p-4 lg:justify-end">
          <Link to="/" className="lg:hidden">
            <BrandMark />
          </Link>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-4 pb-16">
          <div className="w-full max-w-sm animate-fade-up">
            <PageTransition />
          </div>
        </main>
      </div>
    </div>
  );
}
