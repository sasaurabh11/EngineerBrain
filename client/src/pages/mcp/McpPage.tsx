import { KeyRound, Layers, MessageSquareCode, Plug } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownContent } from "@/components/markdown-content";
import { PageHelp } from "@/components/page-help";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// The real local API URL this dev environment's MCP server would point at -
// same value the web app itself uses (see axiosClient.ts), not a placeholder.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:4000/api/v1";
// The real absolute path to this repo's built MCP server entry point on this machine.
const MCP_ENTRY_PATH = "/Users/your-username/EngineerBrain/mcp-server/dist/index.js";

const CLAUDE_DESKTOP_SNIPPET = `\`\`\`json
{
  "mcpServers": {
    "engineerbrain": {
      "command": "node",
      "args": ["${MCP_ENTRY_PATH}"],
      "env": {
        "ENGINEERBRAIN_API_KEY": "eb_live_...",
        "ENGINEERBRAIN_API_URL": "${API_BASE_URL}"
      }
    }
  }
}
\`\`\``;

const CLAUDE_CODE_CLI_SNIPPET = `\`\`\`bash
claude mcp add engineerbrain \\
  -e ENGINEERBRAIN_API_KEY=eb_live_... \\
  -e ENGINEERBRAIN_API_URL=${API_BASE_URL} \\
  -- node ${MCP_ENTRY_PATH}
\`\`\``;

const CURSOR_SNIPPET = `\`\`\`json
{
  "mcpServers": {
    "engineerbrain": {
      "command": "node",
      "args": ["${MCP_ENTRY_PATH}"],
      "env": {
        "ENGINEERBRAIN_API_KEY": "eb_live_...",
        "ENGINEERBRAIN_API_URL": "${API_BASE_URL}"
      }
    }
  }
}
\`\`\``;

const HOSTED_HTTP_SNIPPET = `\`\`\`json
{
  "mcpServers": {
    "engineerbrain": {
      "type": "http",
      "url": "https://<your-deployed-mcp-host>/mcp",
      "headers": { "Authorization": "Bearer eb_live_..." }
    }
  }
}
\`\`\``;

const HOSTED_HTTP_CLI_SNIPPET = `\`\`\`bash
claude mcp add --transport http engineerbrain https://<your-deployed-mcp-host>/mcp \\
  --header "Authorization: Bearer eb_live_..."
\`\`\``;

interface ToolEntry {
  name: string;
  description: string;
}

const TOOL_GROUPS: { label: string; tools: ToolEntry[] }[] = [
  {
    label: "Repository & code",
    tools: [
      { name: "list_repositories", description: "Lists every repository in the organization with sync status, language, stars." },
      { name: "repository_summary", description: "A repository's metadata plus indexing status (files/symbols/frameworks)." },
      { name: "list_files", description: "Every indexed file, with language and line-count metadata." },
      { name: "list_classes", description: "Every indexed class/interface, with location and signature." },
      { name: "list_functions", description: "Every indexed function/method, with location and signature." },
      { name: "get_file", description: "Full source content of one file." },
      { name: "find_symbol_source", description: "Full source, signature, and doc comment for a function/class by name." },
      { name: "dependency_graph", description: "The repository's import/call/extends/implements/dependency edges." },
      { name: "find_endpoints", description: "HTTP API endpoints detected in a repository." },
    ],
  },
  {
    label: "Search",
    tools: [
      { name: "search_repository", description: "Semantic (vector) search over one repository's indexed code." },
      { name: "search_organization", description: "Semantic search across every repository in the org." },
    ],
  },
  {
    label: "Analysis & health",
    tools: [
      {
        name: "repository_health",
        description: "Latest analysis scores (architecture, security, performance, maintainability, complexity, technical debt, ...) plus the architecture summary.",
      },
      { name: "list_findings", description: "Specific findings, filterable by category (SECURITY, PERFORMANCE, ARCHITECTURE, PATTERN, SOLID, DEPENDENCY, QUALITY) and severity." },
    ],
  },
  {
    label: "Workflows & chat",
    tools: [
      { name: "list_available_workflows", description: "The pre-built agent workflows this platform can run, and the params each needs." },
      {
        name: "run_engineering_workflow",
        description: "Starts a workflow (pr-review, issue-triage, architecture-review, onboarding-guide) and waits up to 90s for it to finish.",
      },
      { name: "get_task_status", description: "Checks on a workflow run started by run_engineering_workflow, including its step-by-step log." },
      { name: "ask_repository", description: "Asks EngineerBrain's own retrieval-grounded chat assistant a question; returns an answer with file citations." },
    ],
  },
  {
    label: "Production intelligence",
    tools: [
      { name: "declare_incident", description: "Manually declares a production incident and starts the real correlation/root-cause/recommendation pipeline." },
      { name: "production_incidents", description: "Lists production incidents, optionally filtered by status or severity." },
      { name: "incident_summary", description: "Full details for one incident: status, severity, timeline, and correlated evidence." },
      { name: "root_cause_analysis", description: "The root cause analysis for an incident - most likely cause, confidence, responsible commit/PR/user." },
      { name: "deployment_history", description: "Recent deployments, optionally filtered by service or environment." },
      { name: "service_health", description: "A service's current health snapshot: error rate, p95 latency, risk score." },
      { name: "blast_radius", description: "Estimates which other services might be affected by an incident (same-repository services in this slice)." },
      { name: "generate_postmortem", description: "Generates a full postmortem document for an incident that already has a root cause analysis." },
      { name: "rollback_recommendation", description: "Reports whether a rollback is recommended for an incident, and why." },
    ],
  },
];

const RESOURCES: ToolEntry[] = [
  { name: "engineerbrain://repositories", description: "List of every repository in the organization." },
  { name: "engineerbrain://repositories/{repositoryId}", description: "A repository's summary." },
  { name: "engineerbrain://repositories/{repositoryId}/health", description: "Latest analysis scores + architecture summary." },
  { name: "engineerbrain://repositories/{repositoryId}/findings", description: "All findings from the latest analysis." },
];

const PROMPTS: ToolEntry[] = [
  { name: "repository_review", description: "Full architecture + health + top-findings review (args: repositoryId)." },
  { name: "security_audit", description: "Security-focused findings + score summary (args: repositoryId)." },
  { name: "performance_audit", description: "Performance-focused findings + score summary (args: repositoryId)." },
  { name: "explain_topic", description: "Explains how something works, grounded in real search + file reads (args: repositoryId, topic)." },
  { name: "generate_onboarding_guide", description: "Runs the onboarding-guide workflow (args: repositoryId)." },
  { name: "review_pull_request", description: "Runs the pr-review workflow (args: repositoryId, prNumber)." },
  { name: "triage_issue", description: "Runs the issue-triage workflow (args: repositoryId, issueNumber)." },
];

function ToolList({ entries }: { entries: ToolEntry[] }) {
  return (
    <ul className="divide-y divide-border">
      {entries.map((t) => (
        <li key={t.name} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
          <code className="shrink-0 font-mono text-xs font-medium text-primary sm:w-56">{t.name}</code>
          <p className="text-sm text-muted-foreground">{t.description}</p>
        </li>
      ))}
    </ul>
  );
}

export function McpPage() {
  const { orgSlug = "" } = useParams();

  return (
    <div className="max-w-3xl space-y-6 animate-fade-up">
      <div className="flex items-center gap-1.5">
        <h1 className="text-xl font-semibold text-foreground">MCP integration</h1>
        <PageHelp title="What's on this page">
          <p>
            <strong>Model Context Protocol (MCP)</strong> lets AI clients like Claude Code, Claude Desktop, and Cursor call EngineerBrain's real tools -
            the same repository health, search, and production-intelligence data this web app uses - directly from your editor or chat.
          </p>
          <p>Follow the three steps below in order: get a key, connect a client, then try asking it something using the tool catalog as reference.</p>
        </PageHelp>
      </div>
      <p className="text-sm text-muted-foreground">
        Connect Claude Code, Claude Desktop, Cursor, or any MCP-compatible client to this organization's repositories, analysis, and production data.
      </p>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <KeyRound className="size-3.5" /> 1. Get an API key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            MCP clients authenticate with an organization-scoped API key, not your regular login - non-interactive clients can't do a browser sign-in.
          </p>
          <p>
            Go to <Link to={`/app/${orgSlug}/settings`} className="text-primary hover:underline">Settings → API Keys</Link> and create one. The full key
            (<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">eb_live_...</code>) is shown once - copy it immediately, you won't see it
            again. Only OWNER/ADMIN members can create or revoke keys.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <Plug className="size-3.5" /> 2. Connect your client
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude-code">
            <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto border-b border-border p-0">
              <TabsTrigger
                value="claude-code"
                className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
              >
                Claude Code
              </TabsTrigger>
              <TabsTrigger
                value="claude-desktop"
                className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
              >
                Claude Desktop
              </TabsTrigger>
              <TabsTrigger
                value="cursor"
                className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
              >
                Cursor
              </TabsTrigger>
              <TabsTrigger
                value="other"
                className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
              >
                VS Code / Windsurf
              </TabsTrigger>
              <TabsTrigger
                value="hosted"
                className="rounded-none border-0 px-0.5 pb-2.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase after:bg-primary data-active:bg-transparent data-active:text-foreground"
              >
                Hosted (HTTP)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="claude-code" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">One command, run from anywhere:</p>
              <MarkdownContent content={CLAUDE_CODE_CLI_SNIPPET} />
              <p className="text-sm text-muted-foreground">
                Or add the same shape to a project-root <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.mcp.json</code> file directly
                (identical structure to the Claude Desktop tab).
              </p>
            </TabsContent>

            <TabsContent value="claude-desktop" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Add this to your <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude_desktop_config.json</code>. This runs the MCP
                server as a local subprocess (stdio), pointed at this environment's API on <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{API_BASE_URL}</code>.
              </p>
              <MarkdownContent content={CLAUDE_DESKTOP_SNIPPET} />
              <p className="text-xs text-muted-foreground">Replace the API key with your own from step 1. The path already points at this build's real entry file on this machine.</p>
            </TabsContent>

            <TabsContent value="cursor" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                Same shape as Claude Desktop, added to <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.cursor/mcp.json</code> (project)
                or <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">~/.cursor/mcp.json</code> (global):
              </p>
              <MarkdownContent content={CURSOR_SNIPPET} />
            </TabsContent>

            <TabsContent value="other" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                VS Code and Windsurf both support MCP servers using the same <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">command</code>
                /<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">args</code>/<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">env</code> concept
                as the Claude Desktop tab, but the config file location and top-level key name have changed across versions - check your installed
                version's MCP docs for the current file path and schema, and reuse the <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">command</code>/<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">args</code>/<code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">env</code> values from the Claude Desktop tab regardless of where they go.
              </p>
            </TabsContent>

            <TabsContent value="hosted" className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                If you (or your team) have deployed the MCP server's <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">http</code> transport
                somewhere reachable (see this repo's <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">mcp-server/README.md</code> for
                deploy instructions), any client with HTTP support can connect without running a local process:
              </p>
              <MarkdownContent content={HOSTED_HTTP_SNIPPET} />
              <p className="text-sm text-muted-foreground">Claude Code CLI equivalent:</p>
              <MarkdownContent content={HOSTED_HTTP_CLI_SNIPPET} />
              <p className="text-xs text-muted-foreground">Replace the placeholder host with your actual deployed URL - this app has no way to know that from here.</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <Layers className="size-3.5" /> 3. Available tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Every tool below is a thin adapter over this platform's real REST API - no separate logic, so results always match what you'd see in this
            web app. Try asking your client things like "Review pull request #42" or "What are this repo's biggest security risks?" once connected.
          </p>
          {TOOL_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 text-xs font-medium text-foreground">{group.label}</p>
              <ToolList entries={group.tools} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <MessageSquareCode className="size-3.5" /> Resources &amp; prompts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Resources - read-only, URI-addressable context some clients can attach directly</p>
            <ToolList entries={RESOURCES} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-foreground">Prompts - curated entry points that tell the model which tools to call</p>
            <ToolList entries={PROMPTS} />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        This page covers setup and the full tool catalog. Live connection status, per-client usage counts, and request latency aren't tracked by this
        build yet - each client reports its own connection state locally.
      </p>
    </div>
  );
}
