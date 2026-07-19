import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { AnalysisLedger } from "./components/analysis-ledger";
import { ChatSpecimen, IncidentSpecimen, ScoreSpecimen, TraceSpecimen } from "./components/capability-specimens";
import { McpTranscript } from "./components/mcp-transcript";

const CAPABILITIES = [
  {
    label: "Health scoring",
    title: "A repository health score you can actually act on",
    body: "Ten scores - architecture, security, performance, maintainability, and more - each backed by specific findings and a suggested fix, not just a number.",
    specimen: <ScoreSpecimen />,
  },
  {
    label: "Production intelligence",
    title: "Know a problem exists before a customer tells you",
    body: "Incidents get correlated against real deploys, commits, and pull requests automatically. EngineerBrain proposes a root cause with a confidence score, recommends a fix, and tells you when a rollback is the safer call.",
    specimen: <IncidentSpecimen />,
  },
  {
    label: "Grounded chat",
    title: "Ask it anything. It answers with proof.",
    body: "Every answer cites the actual file it came from. Ask how something works and get a real citation, not a guess.",
    specimen: <ChatSpecimen />,
  },
  {
    label: "Agent workflows",
    title: "Reviews and triage that actually run",
    body: "Pull requests get reviewed automatically: diff, CI status, dependency risk, and what else in the codebase depends on the change. Issues get triaged with a likely root cause and a suggested fix.",
    specimen: <TraceSpecimen />,
  },
];

const STEPS = [
  { title: "Connect", body: "Connect a GitHub organization. One-time, takes under a minute." },
  { title: "Analyze & ask", body: "Get a health score and start asking questions the moment indexing finishes." },
  { title: "Watch production", body: "Link a service to its deploys and metrics so incidents get correlated and triaged automatically." },
  { title: "Automate", body: "Let agents review pull requests, triage issues, and recommend fixes as they come in." },
];

function HomeHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="shrink-0">
          <BrandMark />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <SignedOut>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/sign-up">Get started</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild variant="outline" size="sm">
              <Link to="/organizations">Dashboard</Link>
            </Button>
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </Link>
            <UserButton />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <HomeHeader />

      <main>
        {/* Hero — asymmetric: copy left, real analysis output right, not centered */}
        <section className="mx-auto max-w-6xl px-6 pt-16 pb-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="animate-fade-up">
              <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
                Know what's happening in every repository and every service your team owns - before anything breaks.
              </h1>
              <p className="mt-5 max-w-md text-base text-muted-foreground">
                EngineerBrain scores your codebase's architecture and security, watches production for incidents and proposes a root
                cause before you go looking for one, answers questions with real citations, and reviews pull requests automatically.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <SignedOut>
                  <Button asChild size="lg">
                    <Link to="/sign-up">
                      Connect your first repository <ArrowRight />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/sign-in">Sign in</Link>
                  </Button>
                </SignedOut>
                <SignedIn>
                  <Button asChild size="lg">
                    <Link to="/organizations">
                      Go to your dashboard <ArrowRight />
                    </Link>
                  </Button>
                </SignedIn>
              </div>
            </div>
            <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
              <AnalysisLedger />
            </div>
          </div>
        </section>

        {/* The problem, stated plainly — one authored paragraph, not a feature list */}
        <section className="border-t border-border bg-muted/30 py-16">
          <div className="mx-auto max-w-2xl px-6">
            <p className="text-lg leading-relaxed text-foreground">
              Systems don't fail all at once. A dependency drifts out of date. A pull request merges without anyone catching the
              circular import it introduces. A deploy goes out on a Friday and pages someone at 2am for a service three teams share,
              and by the time anyone finds the log line, the person who'd recognize it is asleep. None of it shows up until it's
              expensive.
            </p>
          </div>
        </section>

        {/* What it does — asymmetric, distinct specimen per capability, not identical cards */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="space-y-16">
            {CAPABILITIES.map((cap, i) => (
              <div key={cap.label} className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div className={cn(i % 2 === 1 && "lg:order-2")}>
                  <span className="font-mono text-[11px] tracking-wide text-primary uppercase">{cap.label}</span>
                  <h3 className="mt-2 text-2xl font-semibold text-balance text-foreground">{cap.title}</h3>
                  <p className="mt-3 max-w-md text-muted-foreground">{cap.body}</p>
                </div>
                <div className={cn(i % 2 === 1 && "lg:order-1")}>{cap.specimen}</div>
              </div>
            ))}
          </div>
        </section>

        {/* How it connects — sequential log lines, not numbered circles */}
        <section className="border-t border-border bg-muted/30 py-16">
          <div className="mx-auto max-w-3xl px-6">
            <ul className="space-y-6">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="w-6 shrink-0 font-mono text-sm text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* The trust point — the approval gate gets its own dedicated moment */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <span className="font-mono text-[11px] tracking-wide text-primary uppercase">How writes work</span>
          <h2 className="mt-2 text-2xl font-semibold text-balance text-foreground">
            Nothing gets written back without a human saying so.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Every agent step that would comment on a pull request, post a check run, or otherwise touch your repository pauses and
            waits for an explicit approval first. Read-only steps — reading a diff, checking CI, searching your code — run on their
            own. Anything that writes doesn't.
          </p>
        </section>

        {/* MCP server — works inside the tools engineers already use */}
        <section className="border-t border-border bg-muted/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="font-mono text-[11px] tracking-wide text-primary uppercase">MCP server</span>
                <h2 className="mt-2 text-2xl font-semibold text-balance text-foreground">Also works inside the tools you already use</h2>
                <p className="mt-3 max-w-md text-muted-foreground">
                  Every capability above is also available as an MCP server. Connect it to Claude Code, Claude Desktop, Cursor, or any
                  MCP-compatible client, and ask it about your repositories without leaving your editor.
                </p>
              </div>
              <McpTranscript />
            </div>
          </div>
        </section>

        {/* Final CTA — plain repeat, no new headline gimmick */}
        <section className="mx-auto max-w-2xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to see what's actually in your codebase?</h2>
          <div className="mt-6">
            <SignedOut>
              <Button asChild size="lg">
                <Link to="/sign-up">
                  Connect your first repository <ArrowRight />
                </Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <Button asChild size="lg">
                <Link to="/organizations">
                  Go to your dashboard <ArrowRight />
                </Link>
              </Button>
            </SignedIn>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center font-mono text-xs text-muted-foreground">
          <img src="/logo-3.png" alt="EngineerBrain" className="h-6 w-auto opacity-70 dark:opacity-80" />
          <p>engineering intelligence, reviewed by machines, decided by humans.</p>
          <div className="flex gap-4">
            <Link to="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
            <Link to="/sign-up" className="hover:text-foreground">
              Get started
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
