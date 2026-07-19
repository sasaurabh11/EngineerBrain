# EngineerBrain

AI-powered engineering intelligence: Context Aware, repository health scoring, retrieval-grounded chat, automated PR review and issue triage, and production incident intelligence — all backed by real analysis of your actual codebases, not templated output.

## What it does

- **Context Aware** — Store Context, Can ask any problem related to your codebase, system in seconds.
- **Repository health scoring** — architecture, security, performance, maintainability, scalability, modularity, layering, documentation, complexity, and technical debt, each backed by specific, file-level findings and a suggested fix.
- **Grounded AI chat** — ask questions about a repository (or your whole organization) and get answers that cite the actual files they came from, streamed token-by-token.
- **Agent workflows** — multi-step autonomous agents that review pull requests (diff, CI status, dependency impact), triage issues (likely root cause, suggested fix), and generate onboarding guides. Anything that writes back to GitHub pauses for human approval first.
- **Production Intelligence (AIOps)** — connect a service to its deploys (GitHub Actions) and metrics (Prometheus), or point Alertmanager at it, and incidents get automatically correlated against real deployments, commits, and pull requests, with an AI-proposed root cause, confidence score, rollback recommendation, and postmortem.
- **Semantic code search & indexing** — every connected repository is parsed, chunked, and embedded for retrieval, powering both the chat assistant and the analysis pipeline.
- **MCP server** — every capability above is also exposed as an [MCP](https://modelcontextprotocol.io) server, so Claude Code, Claude Desktop, Cursor, and other MCP-compatible clients can use it directly. See [mcp-server/README.md](mcp-server/README.md).

## Architecture

Four independently-run services:

```
client/        React + TypeScript + Tailwind + shadcn/ui SPA
server/        Express + TypeScript + Prisma/PostgreSQL - the REST API, auth, GitHub
                integration, background task engine, and Production Intelligence pipeline
ai-service/    Python + FastAPI - LLM orchestration (LangChain/LangGraph over Gemini or
                Groq), repository indexing/parsing, embeddings, and vector search (Qdrant)
mcp-server/    TypeScript + the official MCP SDK - a thin adapter exposing the same
                capabilities to MCP clients over the server's REST API
```

`server` and `ai-service` talk over a small internal HTTP API (shared-secret authenticated); `ai-service` never touches the primary Postgres database directly, and `mcp-server` never has direct database or LLM access — every capability it exposes is a real call into `server`'s public REST API. Background work (repo sync, deployment polling, incident detection) runs through RabbitMQ.

Auth is via [Clerk](https://clerk.com); GitHub repository access is via a GitHub App (installation tokens, not PATs); non-interactive clients (the MCP server, scripts) authenticate with organization-scoped API keys instead.

## Prerequisites

- Node.js 23.6+ (the server runs TypeScript directly via Node's native type-stripping — no build step in dev; older Node versions, or TS features requiring a full transform like enums, aren't supported by this setup)
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- Docker (for local RabbitMQ and Qdrant)
- A PostgreSQL database (e.g. [Supabase](https://supabase.com), or your own instance)
- Accounts/keys: [Clerk](https://dashboard.clerk.com), a [GitHub App](https://github.com/settings/apps) (for repository integration), and at least one of [Gemini](https://aistudio.google.com/apikey) or [Groq](https://console.groq.com/keys) for the LLM provider

## Getting started

Clone the repo:

```bash
git clone https://github.com/sasaurabh11/EngineerBrain.git
cd EngineerBrain
```

### 1. Start local infrastructure

```bash
cd server
docker-compose up -d   # RabbitMQ (5672, management UI on 15672) and Qdrant (6333)
```

### 2. Server (Express API)

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, Clerk keys, GitHub App credentials, etc.
npm install
npm run prisma:migrate
npm run dev             # http://localhost:4000, health check at /api/v1/health
```

### 3. AI service (FastAPI)

```bash
cd ai-service
cp .env.example .env    # fill in GEMINI_API_KEY and/or GROQ_API_KEY, Qdrant, R2 credentials
uv sync
uv run uvicorn app.main:app --reload --port 8001
```

`server/.env`'s `AI_SERVICE_URL` and `AI_SERVICE_API_KEY` must point at this instance and match its `INTERNAL_API_KEY`.

### 4. Client (React app)

```bash
cd client
cp .env.example .env    # VITE_CLERK_PUBLISHABLE_KEY, VITE_API_BASE_URL
npm install
npm run dev              # http://localhost:5173
```

### 5. MCP server (optional, for using EngineerBrain from Claude Code/Desktop/Cursor)

```bash
cd mcp-server
cp .env.example .env
npm install
npm run dev
```

See [mcp-server/README.md](mcp-server/README.md) for the full client setup guide (config snippets for every supported client) and the complete tool/resource/prompt catalog.

## Repository layout

```
client/       Pages, hooks, and API clients for every feature above
server/
  src/modules/       One folder per domain: organization, repo, github, indexing,
                     search, ai, analysis, tasks, production, apiKey, ...
  src/infra/         RabbitMQ, GitHub App client, AI service client, crypto
  prisma/            Schema + migrations (PostgreSQL)
ai-service/
  app/agents/        LangGraph reasoning agents (retriever/synthesizer/critic/planner)
  app/analysis/       Static analysis pipeline (architecture, security, performance, ...)
  app/indexing/       Repository parsing, chunking, symbol/dependency extraction
  app/embeddings/     Embedding provider + Qdrant vector store
mcp-server/
  src/tools/          One file per capability area, mirroring server's REST API
  src/resources/      Read-only, URI-addressable context
  src/prompts/        Curated entry points for MCP clients
```

## Testing & builds

```bash
cd server && npm test && npm run build     # vitest + tsc
cd client && npm run lint && npm run build # eslint + tsc + vite build
cd mcp-server && npm run build             # tsc
```

## Known limitations

- Analytics (cross-repository/org-level trend dashboards) and a live MCP usage/connection dashboard are not built yet — both would need new backend aggregation that doesn't exist in this codebase today.
- The MCP server's `blast_radius` tool only reasons about services in the same repository; code-level dependent-service analysis is available through the AI chat assistant, not yet as a direct MCP tool.
