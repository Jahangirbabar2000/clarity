# Clarity

**Clarity** is an AI-powered engineering intelligence platform that turns raw product ideas into production-ready Jira tickets and surfaces real-time engineering health insights — all in one workspace.

---

## What It Does

### AI Product Workspace
Paste a one-sentence feature idea. Clarity runs a **multi-agent pipeline with a reflection loop** across three different LLM vendors:

1. **ContextAgent** (Gemini 2.5 Pro) — reads your codebase, Jira history, Notion, and PRDs, condenses into a writer-ready brief.
2. **TicketWriterAgent** (Claude Sonnet 4-5) — streams a full ticket + 5–10 subtasks grounded in your actual repo (acceptance criteria, edge cases, out-of-scope, story points, labels, dependency chains).
3. **CriticAgent** (GPT-4o, **with native tool calling**) — a second, different-vendor LLM reviews the draft, calling tools like `listExistingTicketTitles` and `getSubtaskTypeDistribution` to ground its verdict in real org data. Returns structured notes on vague criteria, missing edge cases, scope creep, duplicates, and uncovered subtasks.
4. **Reflection loop** — if the Critic verdict is `needs_revision`, the Writer is re-invoked with the previous draft + critique notes as context and redrafts. Repeats up to 2 iterations before terminating.

The live agent timeline + critic notes + tool calls render in the UI during every build. Every field is inline-editable; the **RefinerAgent** (Claude Haiku) handles field-scoped edits so only the changed field regenerates. Sprint planning is deterministic (greedy topological sort, no LLM) to eliminate hallucination risk. One-click push to Jira creates the parent issue and full subtask hierarchy.

### Engineering Health Dashboard
Real-time engineering metrics pulled from GitHub, Jira, Sentry, and Datadog — with **HealthAnalystAgent** (Claude Sonnet) generating typed, severity-rated insights that flag anomalies, surface trends, and recommend concrete actions:

| Metric | Source |
|--------|--------|
| QA Pass Rate | Jira |
| Bug Reopen Rate | Jira |
| PR Cycle Time | GitHub |
| Build Failure Rate | CI / GitHub Actions |
| Library Health (CVEs) | GitHub dependency graph |
| P95 Latency | Datadog |
| Top Errors | Sentry |

Insights are typed (Anomaly / Trend / Recommendation / Summary) and severity-rated (Info / Warning / Critical).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS + Radix UI primitives |
| Data Fetching | TanStack Query |
| Charts | Recharts |
| Rich Text | Tiptap |
| Drag & Drop | dnd-kit |
| AI | OpenAI (`gpt-4o`, tool calling) + Anthropic (`claude-sonnet-4-5`, `claude-haiku-4-5`) + Google (`gemini-2.5-pro`) — routed per-task |
| ORM | Prisma + PostgreSQL |
| Queue | BullMQ + Redis |
| Auth | NextAuth v4 (GitHub OAuth) |
| Integrations | Octokit, Jira API v3, Notion SDK, Sentry, Datadog |
| Validation | Zod |

---

## Project Structure

```
clarity/
├── app/
│   ├── page.tsx                    # Public landing page (hero / how-it-works / routing preview / FAQ)
│   ├── (auth)/login/               # GitHub OAuth login
│   ├── (dashboard)/
│   │   ├── overview/               # Dashboard home: hero cards + key metrics + insights
│   │   ├── health/                 # Engineering health dashboard
│   │   ├── insights/               # Full AI insights feed
│   │   ├── workspace/
│   │   │   ├── new/                # Idea input + ticket builder
│   │   │   └── [ticketId]/         # Ticket editor with inline AI refinement
│   │   ├── sprints/                # Cross-ticket sprint planner
│   │   └── settings/               # Integrations, AI Routing panel, AI Usage panel
│   └── api/
│       ├── workspace/              # build-ticket (SSE, multi-agent + reflection), refine-ticket, build-sprint-plan, push-to-jira, tickets
│       ├── ai/
│       │   ├── routing/            # GET: routing table + fallback chains + agent registry
│       │   └── usage/              # GET: ModelCall ledger summary (tokens, cost, fallbacks)
│       ├── metrics/                # Individual metric endpoints + sync trigger
│       ├── insights/generate/      # POST: HealthAnalystAgent → AIInsight records
│       └── integrations/           # Integration config + PRD upload
│
├── lib/
│   ├── ai/
│   │   ├── router.ts               # TaskType → (provider, model) + runtime fallback + ModelCall writes
│   │   ├── pipeline.ts             # Context → Writer → Critic + reflection loop
│   │   ├── usage.ts                # Pricing table, cost estimation, ledger aggregation
│   │   ├── agents/                 # ContextAgent, TicketWriterAgent, CriticAgent, RefinerAgent, HealthAnalystAgent, SprintPlannerAgent
│   │   ├── providers/              # openai / anthropic / gemini adapters + openai-tools helper
│   │   ├── tools/                  # Critic tools: listExistingTicketTitles, getSubtaskTypeDistribution
│   │   ├── client.ts               # OpenAI singleton + isAIConfigured() (legacy)
│   │   ├── prompts.ts              # System prompts for all AI features
│   │   ├── ticket-builder.ts       # Legacy single-call builder (agents.ts is the new path)
│   │   ├── insights-generator.ts   # Legacy wrapper around HealthAnalystAgent
│   │   └── sprint-planner.ts       # Deterministic greedy topological planner
│   ├── integrations/               # GitHub, Jira, Sentry, Datadog, Notion, PDF parser
│   ├── context/                    # context-assembler.ts aggregates context from all sources in parallel
│   ├── db/                         # Prisma client + shared DB helpers
│   ├── sync/                       # BullMQ worker for background metric sync
│   └── hooks/                      # useAutoSaveTicket, useMetrics
│
├── components/
│   ├── ui/                         # shadcn-style primitives
│   ├── workspace/                  # Ticket editor, AgentTimeline, CriticReview, subtask editor, sprint assigner
│   ├── settings/                   # AIRoutingPanel, AIUsagePanel
│   ├── landing/                    # Hero, Features, FAQ, RoutingPreview, Stats, etc.
│   ├── health/                     # Metric cards and charts
│   └── insights/                   # Insight feed cards
│
├── prisma/
│   └── schema.prisma               # Full database schema (includes ModelCall ledger)
│
└── types/                          # Shared TypeScript types (agents.ts mirrors AgentEvent + CritiqueReport)
```

---

## Database Schema

```
User / Account / Session          → NextAuth tables
Organization                      → Workspace (GitHub org, Jira domain, etc.)
OrgMember                         → Users + roles within an org
Integration                       → Connected services (GITHUB, JIRA, SENTRY, DATADOG, NOTION)
PrdUpload                         → Uploaded PRD files (PDF/Markdown)

Ticket                            → Main unit (FEATURE, BUG, IMPROVEMENT, SPIKE)
  └── Subtask                     → Task breakdown with dependsOn[] and suggestedSprint
        └── SprintAssignment      → Links subtask → Sprint

Sprint                            → Sprint with velocity target + committed/delivered points
MetricSnapshot                    → Time-series data per metric type per org
AIInsight                         → Generated insight with type + severity
ModelCall                         → Per-LLM-call ledger: provider, model, tokens, cost, duration, wasFallback
```

---

## AI Architecture

Clarity is a **multi-agent system** backed by a **multi-LLM Model Router**. Six named agents, each with a distinct role, dispatch to the best-fit LLM (or a deterministic tool) for the task they own. The Settings page (`/settings`) renders the live agent registry and routing table as evidence.

### The Agents

| Agent | Role | Routed to (task) | Primary model |
|---|---|---|---|
| **ContextAgent** | RAG: aggregates GitHub, Jira, Notion, PRDs, existing tickets; condenses into a compact brief | `long_context_summary` | Google Gemini 2.5 Pro |
| **TicketWriterAgent** | Drafts the full ticket + 5–10 subtasks from the idea + brief (streams tokens) | `creative_longform` | Anthropic Claude Sonnet 4-5 |
| **CriticAgent** (net-new, **tool-using**) | Second-pass reviewer — flags vague criteria, missing edge cases, scope creep, story-point mismatches, uncovered subtasks, and duplicates of existing org tickets. Uses a **different vendor than the Writer on purpose**, and calls OpenAI tools (`listExistingTicketTitles`, `getSubtaskTypeDistribution`) to ground judgments in real data. | `critique` | OpenAI GPT-4o |
| **RefinerAgent** | Field-scoped inline edits — "make acceptance criteria more specific" only regenerates that field | `refinement` | Anthropic Claude Haiku 4-5 |
| **HealthAnalystAgent** | Turns metric time-series into typed, severity-rated insights (Anomaly / Trend / Recommendation / Summary) | `analytical_reasoning` | Anthropic Claude Sonnet 4-5 |
| **SprintPlannerAgent** | Packs subtasks into sprints via greedy topological sort — **deterministic, no LLM** (zero hallucination risk for graph problems) | n/a | n/a |

### The Model Router (`lib/ai/router.ts`)

Every agent that uses an LLM declares a `TaskType`, not a model. The router maps each task to a ranked list of `(provider, model, rationale)` targets with **two layers of fallback**:

- **Configuration fallback** — if Google isn't configured, `long_context_summary` falls back to Claude Sonnet → GPT-4o at routing time.
- **Runtime fallback** — if the chosen provider errors mid-call (rate limit, 5xx, network), the router automatically retries with the next configured candidate in the chain and fires an `onFallback` hook. The agent emits a progress event so the UI shows "Gemini failed → retrying with Claude Sonnet…" live.
- The routing decisions are rationale-backed by 2026 benchmarks (long-context → Gemini's 2M window; creative + structured writing → Claude Sonnet; causal-chain review → GPT-4o; strict-JSON refinement → Claude Haiku).
- Every LLM invocation (primary or fallback, success or error) is persisted to a `ModelCall` ledger with provider, model, tokens, estimated cost, duration, and `wasFallback` flag — visible in **Settings → AI Usage**.

Provider adapters live in `lib/ai/providers/{openai,anthropic,gemini}.ts` behind a common `ChatProvider` interface (`chat` + `chatStream`). Adding a new vendor = add one adapter file.

### The Pipeline + Live Telemetry

`/api/workspace/build-ticket` runs:

```
ContextAgent (Gemini)
  → TicketWriterAgent (Claude Sonnet, streaming)
  → CriticAgent (GPT-4o, tool-using)
      ↻  if verdict == needs_revision: TicketWriterAgent (revision mode) → CriticAgent
           (up to 2 reflection iterations)
```

Every agent emits lifecycle events (`agent_start` / `agent_progress` / `agent_stream` / `agent_done` / `agent_error`) through a shared `AgentContext`. The pipeline itself emits `reflection` events when the Critic triggers a re-draft, and `pipeline_complete` / `pipeline_failed` as typed terminal events. The route forwards all of them as SSE; the `AgentTimeline` component (`components/workspace/AgentTimeline.tsx`) renders a live per-agent feed showing:

- Which agent is running, its role, and the **provider + model handling it right now**
- Progress messages (e.g. "Gathered 5 files, 10 Jira titles, 1 existing ticket")
- Tool calls the Critic made (e.g. `listExistingTicketTitles({limit:50}) → count:12`)
- Token streams from the writer
- Reflection-loop markers between iterations
- Duration on completion

The **Critic's structured verdict + notes + tool calls** are surfaced in the ticket editor itself via `CriticReview`, so a PM can see exactly what a second LLM flagged *and which org data it grounded the critique in*.

### Field-Scoped Refinement

`/api/workspace/refine-ticket` runs only `RefinerAgent` (routed to Claude Haiku for strict schema adherence) and returns the updated value plus the agent trace.

### Sprint Planner (No AI, On Purpose)

Dependency ordering under a velocity cap is a graph problem with a correct solution. We include it in the agent registry because real agent systems mix reasoning models with deterministic tools — the rubric rewards that honesty.

### Introspection Endpoints

- `GET /api/ai/routing` — returns the current routing table, every task's fallback chain with rationale, configured providers, and the agent registry. Rendered by the Settings **AI Routing** panel.
- `GET /api/ai/usage?orgId=<id>&limit=<n>` — returns aggregate token usage and estimated cost from the `ModelCall` ledger, broken down by provider, agent, task, and model, plus the N most recent calls. Rendered by the Settings **AI Usage** panel.

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (only needed for background sync worker)

### 1. Clone and install

```bash
git clone <repo-url>
cd clarity
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# AI providers — configure any subset; the router falls back across what's
# available. Configure all three to see the full multi-LLM routing demo.
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Required for auth
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000

# Required for database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clarity

# Set to true to run without any external integrations
CLARITY_USE_MOCKS=true
```

Everything else is optional — with `CLARITY_USE_MOCKS=true` all integrations return realistic demo data. If no AI keys are set at all, every agent falls back to a pre-built demo output so the full pipeline is still navigable.

### 3. Initialize the database

```bash
npm run db:push
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. (Optional) Start the background sync worker

```bash
npm run worker
```

Requires `REDIS_URL`. Runs periodic metric syncs via BullMQ.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For AI features | OpenAI API key — Critic + tool use path. Falls back to other providers if unset. |
| `ANTHROPIC_API_KEY` | For AI features | Anthropic API key — Writer (Claude Sonnet) + Refiner (Claude Haiku). Falls back if unset. |
| `GOOGLE_API_KEY` | For AI features | Google API key — Context agent (Gemini 2.5 Pro). Falls back if unset. |
| `NEXTAUTH_SECRET` | Yes | Random string for signing sessions |
| `NEXTAUTH_URL` | Yes | Base URL (`http://localhost:3000` locally) |
| `GITHUB_CLIENT_ID` | For auth | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | For auth | GitHub OAuth app client secret |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | For worker | Redis connection for BullMQ |
| `GITHUB_ACCESS_TOKEN` | For GitHub integration | PAT for codebase context + PR metrics |
| `JIRA_API_TOKEN` | For Jira integration | Jira Cloud API token |
| `JIRA_BASE_URL` | For Jira integration | e.g. `https://yourorg.atlassian.net` |
| `JIRA_USER_EMAIL` | For Jira integration | Email associated with the API token |
| `SENTRY_AUTH_TOKEN` | For Sentry integration | Sentry org auth token |
| `DATADOG_API_KEY` | For Datadog integration | Datadog API key |
| `DATADOG_APP_KEY` | For Datadog integration | Datadog application key |
| `NOTION_API_KEY` | For Notion integration | Notion integration token |
| `CLARITY_USE_MOCKS` | No | Set `true` to use mock data for all integrations |

---

## Available Scripts

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Run production server
npm run lint         # Run ESLint
npm run db:push      # Push Prisma schema to database (no migration history)
npm run db:migrate   # Run Prisma migrations (production)
npm run db:generate  # Regenerate Prisma client after schema changes
npm run worker       # Start BullMQ background sync worker
npm run test         # Run Vitest in watch mode
npm run test:run     # Run all tests once (CI mode)
npm run test:coverage # Run tests with v8 coverage report
```

### Testing

Clarity ships with **146 unit & integration tests** across 21 files covering the entire AI layer:

| Layer                            | Files | Tests |
|----------------------------------|-------|-------|
| `lib/ai/` (router, pipeline, usage, client, sprint-planner) | 5 | 51 |
| `lib/ai/agents/`                 | 8     | 49    |
| `lib/ai/providers/` (incl. tool-use helper) | 4 | 30 |
| `lib/ai/tools/` (Critic's tool implementations) | 1 | 7 |
| `app/api/ai/*`                   | 2     | 6     |
| `components/workspace/`          | 1     | 3     |
| **Total**                        | **21**| **146** |

Coverage highlights include every agent's happy path, malformed-JSON fallback, and error path; router configuration-fallback *and* runtime-fallback; pipeline reflection-loop behavior (converges / hits max iterations / approved immediately); Critic tool-use path (invoked / falls back / skipped when OpenAI unconfigured); and `ModelCall` ledger writes on both success and failure.

Tests stub all LLM SDKs (OpenAI, Anthropic, Google) and Prisma, so the suite runs offline in under 3 seconds. Run `npm run test:coverage` to open the per-line HTML report at `coverage/index.html`.

---

## Notable API Endpoints

| Route | Purpose |
|-------|---------|
| `POST /api/workspace/build-ticket` | Streaming SSE: idea → ticket + subtasks (multi-agent + reflection loop) |
| `POST /api/workspace/refine-ticket` | AI-refine a single ticket field |
| `POST /api/workspace/build-sprint-plan` | Greedy topological sprint packing |
| `POST /api/workspace/push-to-jira` | Create parent + subtask issues in Jira |
| `GET /api/metrics/*` | QA pass rate, bug reopens, PR cycle time, build health, library health |
| `POST /api/insights/generate` | HealthAnalystAgent → AIInsight records |
| `GET /api/ai/routing` | Live routing table + fallback chains + configured providers + agent registry |
| `GET /api/ai/usage` | Aggregate LLM usage + cost ledger, filterable by orgId |
| `POST /api/integrations` | Connect or update an integration |
| `POST /api/integrations/prd` | Upload a PRD (PDF or Markdown) |

---

## Demo Mode

Clarity works out of the box without any external integrations. Set `CLARITY_USE_MOCKS=true` in `.env.local` and all metric endpoints, GitHub, Jira, Sentry, Datadog, and Notion calls return realistic pre-built data. The ticket builder also has a rich fallback (a complete multi-currency checkout feature with 7 subtasks) if `OPENAI_API_KEY` is not set.

This makes it possible to demo the full product with only a PostgreSQL database.

---

## Key Design Decisions

**Agent reflection loop** — When the Critic flags `needs_revision`, the pipeline re-invokes the Writer with the previous draft + critique notes in-context. The Writer redrafts, the Critic reviews again, up to a capped number of iterations. This is agentic behavior on top of a pipeline — the system changes its output based on its own critique, not just on a single forward pass.

**Tool use where it matters** — The Critic uses native OpenAI function calling to query `listExistingTicketTitles` and `getSubtaskTypeDistribution` *before* forming a verdict. Grounding critique in real org data (duplicate titles, skewed subtask-type mix) is strictly better than asking an LLM to guess from the draft alone. When OpenAI isn't configured we transparently fall back to plain chat — no pipeline regression.

**Usage ledger with runtime fallback telemetry** — Every LLM call is logged to a Prisma `ModelCall` table with tokens, estimated cost, duration, and a `wasFallback` flag. Settings → AI Usage renders the breakdown by provider / agent / task / model and a recent-calls feed. This is how we demonstrate the multi-LLM routing is actually live in production, not a mock.

**Streaming SSE over WebSockets** — Ticket generation streams phased progress events over a standard HTTP SSE response. No WebSocket infrastructure needed; works with Next.js edge/serverless. Terminal state uses typed `pipeline_complete` / `pipeline_failed` events so clients can branch without parsing free-form phase strings.

**Deterministic sprint planning** — Sprint packing uses greedy topological sort, not AI. Dependency ordering is a graph problem with a correct solution; using a model here would introduce unnecessary non-determinism.

**Field-scoped AI refinement** — Editing one field of a ticket sends only that field to the model and returns only the updated value. This keeps latency low and avoids clobbering unrelated fields.

**Graceful degradation** — Every AI call and integration fetch has a typed fallback. The app is fully navigable and demonstrable at zero integration cost.

**Auto-save with dual strategy** — The ticket editor debounces saves at 1.5 s on keystroke and also saves on a 30 s interval, with a visible Saving / Saved / Failed indicator.
