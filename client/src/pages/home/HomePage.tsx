import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import {
  ArrowRight,
  Bot,
  GitBranch,
  GitPullRequest,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Repository health analysis",
    description: "Deep static analysis across architecture, security, performance, and maintainability — scored and explained, not just linted.",
  },
  {
    icon: MessageSquare,
    title: "AI chat, grounded in your code",
    description: "Ask questions about any repository and get answers with real citations to the files and symbols they came from.",
  },
  {
    icon: Bot,
    title: "Autonomous agent tasks",
    description: "Multi-step agents review pull requests, triage issues, and write onboarding guides — pausing for your approval on anything that writes back to GitHub.",
  },
  {
    icon: GitPullRequest,
    title: "CI/CD & dependency awareness",
    description: "PR reviews that check CI status, diff dependency changes against OSV.dev, and run diff-scoped static analysis before you merge.",
  },
  {
    icon: GitBranch,
    title: "One GitHub connection",
    description: "Connect a GitHub App once; import and keep repositories, branches, commits, pull requests, and issues in sync automatically.",
  },
  {
    icon: Users,
    title: "Built for teams",
    description: "Invite teammates, assign roles, and keep every organization's repositories, tasks, and conversations cleanly separated.",
  },
];

const STEPS = [
  { title: "Connect", description: "Install the GitHub App and import the repositories you want EngineerBrain to understand." },
  { title: "Analyze & chat", description: "Get a scored health report for every repository, then ask the AI assistant anything about the codebase." },
  { title: "Automate", description: "Hand off pull request reviews, issue triage, and onboarding docs to agents — you stay in control of anything that writes back." },
];

function HomeHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignedOut>
            <Button asChild variant="ghost" size="sm">
              <Link to="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/sign-up">
                Get started <ArrowRight />
              </Link>
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
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            AI-powered engineering intelligence
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            Understand, chat with, and automate your codebase
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            EngineerBrain connects to your GitHub organization, scores every repository's health, answers questions grounded in real code, and
            runs autonomous agents for PR review, issue triage, and onboarding — all with a human in the loop.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <SignedOut>
              <Button asChild size="lg">
                <Link to="/sign-up">
                  Get started free <ArrowRight />
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
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="space-y-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-4.5" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{feature.title}</p>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-muted/30 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-center text-2xl font-semibold text-foreground">How it works</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.title} className="space-y-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Ready to understand your codebase?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Connect a GitHub organization and get your first repository health report in minutes.
          </p>
          <div className="mt-6">
            <SignedOut>
              <Button asChild size="lg">
                <Link to="/sign-up">
                  Get started free <ArrowRight />
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
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-center">
          <BrandMark />
          <p className="text-xs text-muted-foreground">AI engineering intelligence for teams shipping real code.</p>
        </div>
      </footer>
    </div>
  );
}
