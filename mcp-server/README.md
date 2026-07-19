# EngineerBrain MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes EngineerBrain's engineering intelligence — repository health analysis, semantic code search, dependency graphs, and multi-step engineering agent workflows — to any MCP-compatible AI client (Claude Code, Claude Desktop, Cursor, VS Code, Windsurf).

This server contains **no business logic**. Every tool, resource, and prompt is a thin adapter that calls the existing EngineerBrain Express API and reshapes the response for MCP. Analysis, parsing, embeddings, and agent orchestration all continue to happen in the main platform (`server/` + `ai-service/`) exactly as they do today for the web app.

```
Claude Code / Claude Desktop / Cursor / VS Code / Windsurf
                    │  (stdio subprocess, or Streamable HTTP)
                    ▼
            EngineerBrain MCP Server           <- this package
    ┌───────────────────────────────────────────┐
    │ 1. Resolve caller → org + role (API key)   │
    │ 2. Map MCP tool/resource/prompt → REST call│
    │ 3. Call Express, reshape response for MCP  │
    │ 4. Map Express errors → MCP tool errors    │
    └───────────────────────────────────────────┘
                    │  HTTPS, Bearer <api-key>
                    ▼
        EngineerBrain Express API (unchanged)
                    │
                    ▼
        FastAPI / Postgres / Vector DB / Agent Platform
```

## Authentication

This server authenticates with an **organization-scoped API key**, not your Clerk login — non-interactive clients like Claude Desktop can't do a browser sign-in.

1. Sign in to the EngineerBrain web app, open the organization you want to expose, go to **Settings → API Keys**, and create one. The full key (`eb_live_...`) is shown once — copy it immediately.
2. Every request made through this server uses that key as a `Bearer` token. It resolves to a single fixed organization (`GET /me` returns `apiKeyOrganization`) — there is no way to access a different org with the same key.
3. Only `OWNER`/`ADMIN` members can create or revoke keys, matching every other admin action in the platform.
4. Revoking a key takes effect immediately — the next request with that key gets a 401.

The key only grants what the underlying REST API already allows for that org/role; this server adds no new permissions.

## Using the hosted instance

You don't need to install or run anything to use EngineerBrain from your AI client — a shared instance is already running the `http` transport at:

```
https://engineerbrain-mcp.onrender.com/mcp
```

All you need is your own API key (see **Authentication** above). Everyone connects to the same URL; the bearer token in each request is what scopes you to your organization.

**Claude Code** — one command:
```bash
claude mcp add --transport http engineerbrain https://engineerbrain-mcp.onrender.com/mcp \
  --header "Authorization: Bearer eb_live_..."
```

**Claude Desktop** — `claude_desktop_config.json` (Desktop connects to Streamable HTTP servers directly, no local process or proxy needed):
```json
{
  "mcpServers": {
    "engineerbrain": {
      "type": "http",
      "url": "https://engineerbrain-mcp.onrender.com/mcp",
      "headers": { "Authorization": "Bearer eb_live_..." }
    }
  }
}
```

**Cursor / any MCP client with HTTP support** — same `type`/`url`/`headers` shape, in that client's MCP config file.

Note: Render's free tier spins the service down after 15 minutes of inactivity, so the first request after idle time takes a few extra seconds to cold-start — expected, not a bug.

The rest of this README covers self-hosting your own instance (e.g. against a different EngineerBrain deployment, or to run the stdio transport locally).

## Installation

```bash
cd mcp-server
npm install
npm run build   # emits dist/, or use `npm run dev` for a live-reloading local run
```

## Running

There are two transports, chosen via `MCP_TRANSPORT`:

| Transport | When to use it | How a client reaches it |
|---|---|---|
| `stdio` (default) | Local use — Claude Desktop/Code/Cursor spawn this as a subprocess | Client's own config, via `command`/`args`/`env` |
| `http` | A centrally-hosted, multi-tenant server serving many users/orgs at once | `Authorization: Bearer <key>` header per request |

```bash
# stdio (what a client config below actually runs)
ENGINEERBRAIN_API_KEY=eb_live_... npm start

# Streamable HTTP, listening on MCP_HTTP_PORT (default 3800)
MCP_TRANSPORT=http npm start
```

See `.env.example` for every environment variable.

## Deploying the hosted instance

This runs as a plain Node web service — on Render:

- Root directory: `mcp-server`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Env vars: `MCP_TRANSPORT=http`, `ENGINEERBRAIN_API_URL=https://<your-express-api-host>/api/v1`
  (leave `ENGINEERBRAIN_API_KEY` unset — that's stdio-only)

`transport/http.ts` binds to `process.env.PORT` when the platform sets one (Render, Railway, etc.), falling back to `MCP_HTTP_PORT` for manual/local runs.

One instance only: `sessions` in `transport/http.ts` is an in-memory `Map`, so a session created on one instance isn't visible to another. Don't scale this past a single instance without adding a shared session store first.

## Client configuration

The `stdio` shape below is identical for Claude Desktop, Claude Code, and Cursor — only the config file's location differs. Replace the `args` path with the absolute path to this package's `dist/index.js` on your machine, and use a real API key.

**Claude Desktop** — `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "engineerbrain": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "ENGINEERBRAIN_API_KEY": "eb_live_...",
        "ENGINEERBRAIN_API_URL": "https://api.your-engineerbrain-host.com/api/v1"
      }
    }
  }
}
```

**Claude Code** — project-root `.mcp.json` (same shape), or via the CLI:
```bash
claude mcp add engineerbrain -e ENGINEERBRAIN_API_KEY=eb_live_... -e ENGINEERBRAIN_API_URL=https://api.your-host.com/api/v1 -- node /absolute/path/to/mcp-server/dist/index.js
```

**Cursor** — `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), same shape as Claude Desktop above.

**VS Code / Windsurf** — both support MCP servers with the same `command`/`args`/`env` concept, but the config file location and top-level key name have changed across versions. Check your installed version's MCP documentation for the current file/schema; the `command`, `args`, and `env` values above are what you need regardless of where they go.

**Any client, against a remote Streamable HTTP deployment** (skip the local `command`/`args` entirely — see **Using the hosted instance** above for the concrete URL and Claude Code CLI one-liner):
```json
{
  "mcpServers": {
    "engineerbrain": {
      "type": "http",
      "url": "https://mcp.your-engineerbrain-host.com/mcp",
      "headers": { "Authorization": "Bearer eb_live_..." }
    }
  }
}
```

## What you can ask, once connected

- "Explain how authentication works in this repository."
- "Show me this repo's architecture and security scores."
- "Find all Redis usage across the organization."
- "Review pull request #42."
- "Triage issue #17 and tell me the likely root cause."
- "Generate an onboarding guide for this repository."
- "What SOLID violations were found in this repo?"

## Tools

| Tool | Description |
|---|---|
| `list_repositories` | Lists every repository in the organization with sync status, language, stars. |
| `repository_summary` | A repository's metadata plus indexing status (files/symbols/frameworks). |
| `search_repository` | Semantic (vector) search over one repository's indexed code. |
| `search_organization` | Semantic search across every repository in the org. |
| `list_files` | Every indexed file, with language and line-count metadata. |
| `list_classes` | Every indexed class/interface, with location and signature. |
| `list_functions` | Every indexed function/method, with location and signature. |
| `get_file` | Full source content of one file. |
| `find_symbol_source` | Full source, signature, and doc comment for a function/class by name. |
| `dependency_graph` | The repository's import/call/extends/implements/dependency edges. |
| `find_endpoints` | HTTP API endpoints detected in a repository. |
| `repository_health` | Latest analysis scores (architecture, security, performance, maintainability, complexity, technical debt, ...) plus the written architecture summary. |
| `list_findings` | Specific findings, filterable by category (`SECURITY`, `PERFORMANCE`, `ARCHITECTURE`, `PATTERN`, `SOLID`, `DEPENDENCY`, `QUALITY`) and severity. |
| `list_available_workflows` | The pre-built agent workflows this platform can run, and the params each needs. |
| `run_engineering_workflow` | Starts a workflow (`pr-review`, `issue-triage`, `architecture-review`, `onboarding-guide`) and waits up to 90s for it to finish. Write-back steps (posting to GitHub) pause for a human's approval in the web app. |
| `get_task_status` | Checks on a workflow run started by `run_engineering_workflow`, including its step-by-step log. |
| `ask_repository` | Asks EngineerBrain's own retrieval-grounded chat assistant a question; returns a synthesized answer with file citations. |
| `declare_incident` | Manually declares a production incident and starts the real correlation/root-cause/recommendation pipeline against it. |
| `production_incidents` | Lists production incidents, optionally filtered by status or severity. |
| `incident_summary` | Full details for one incident: status, severity, timeline, and correlated evidence. |
| `root_cause_analysis` | The root cause analysis for an incident - most likely cause, confidence score, responsible commit/PR/user. |
| `deployment_history` | Recent deployments, optionally filtered by service or environment. |
| `service_health` | A service's current health snapshot: error rate, p95 latency, risk score. |
| `blast_radius` | Estimates which other services might be affected by an incident (same-repository services only in this slice - ask EngineerBrain AI chat for code-level blast radius). |
| `generate_postmortem` | Generates a full postmortem document for an incident that already has a root cause analysis. |
| `rollback_recommendation` | Reports whether a rollback is recommended for an incident, and why. |

## Resources

| URI | Description |
|---|---|
| `engineerbrain://repositories` | List of every repository in the organization. |
| `engineerbrain://repositories/{repositoryId}` | A repository's summary. |
| `engineerbrain://repositories/{repositoryId}/health` | Latest analysis scores + architecture summary. |
| `engineerbrain://repositories/{repositoryId}/findings` | All findings from the latest analysis. |

## Prompts

| Prompt | Arguments | What it does |
|---|---|---|
| `repository_review` | `repositoryId` | Full architecture + health + top-findings review. |
| `security_audit` | `repositoryId` | Security-focused findings + score summary. |
| `performance_audit` | `repositoryId` | Performance-focused findings + score summary. |
| `explain_topic` | `repositoryId`, `topic` | Explains how something works, grounded in real search + file reads. |
| `generate_onboarding_guide` | `repositoryId` | Runs the onboarding-guide workflow. |
| `review_pull_request` | `repositoryId`, `prNumber` | Runs the pr-review workflow. |
| `triage_issue` | `repositoryId`, `issueNumber` | Runs the issue-triage workflow. |

## Developer guide

```
src/
  index.ts                 entry point - picks stdio or http from MCP_TRANSPORT
  server/createServer.ts   builds one McpServer bound to a resolved identity
  transport/{stdio,http}   stdio: resolve once at boot; http: resolve per session
  auth/{context,apiKeyAuth} AuthContext type + bearer-token → org identity
  clients/                 backendClient (JSON envelope) + chatStreamClient (raw SSE)
  middleware/errorMapper   thrown errors → { isError: true } tool results
  tools/                   one file per capability area
  resources/               read-only, URI-addressable context
  prompts/                 curated entry points that tell the model which tools to call
  types/backend.types.ts   hand-maintained mirror of the Express DTOs this server uses
```

**Adding a new tool:**
1. Add the Express response shape it needs to `types/backend.types.ts` (only if not already there).
2. Add a `register*Tools(server, auth)` function to the relevant file under `tools/` (or a new file for a new capability area), calling `backendRequest`/`streamChatMessage` and wrapping the handler in `withToolErrorHandling`.
3. Call it from `server/createServer.ts`.
4. Never call `fetch` directly from a tool file, and never add Prisma/database access here — if the data doesn't exist via a REST endpoint yet, add one to the Express API first.

**Every log line goes to stderr** (`logging/logger.ts`) — the stdio transport uses stdout as the JSON-RPC wire, and anything written there corrupts the protocol stream. Never `console.log` in this package.
