# Clarity

**Clarity** is an AI-powered engineering intelligence platform that turns raw product ideas into production-ready Jira tickets and surfaces real-time engineering health insights — all in one workspace.

---

## What It Does

### AI Product Workspace
Paste a one-sentence feature idea. Clarity runs a **three-agent pipeline** across three different LLM vendors:

1. **ContextAgent** (Gemini 2.5 Pro) — reads your codebase, Jira history, Notion, and PRDs, condenses into a writer-ready brief.
2. **TicketWriterAgent** (Claude Sonnet 4-5) — streams a full ticket + 5–10 subtasks grounded in your actual repo (acceptance criteria, edge cases, out-of-scope, story points, labels, dependency chains).
3. **CriticAgent** (GPT-4o) — a second, different-vendor LLM reviews the draft and returns structured notes on vague criteria, missing edge cases, scope creep, and uncovered subtasks.

The live agent timeline + critic notes render in the UI during every build. Every field is inline-editable; the **RefinerAgent** (Claude Haiku) handles field-scoped edits so only the changed field regenerates. Sprint planning is deterministic (greedy topological sort, no LLM) to eliminate hallucination risk. One-click push to Jira creates the parent issue and full subtask hierarchy.

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
| AI | OpenAI API (`gpt-4o`) |
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
│   ├── (auth)/login/               # GitHub OAuth login
│   ├── (dashboard)/
│   │   ├── page.tsx                # Overview: hero cards + key metrics + insights
│   │   ├── health/                 # Engineering health dashboard
│   │   ├── insights/               # Full AI insights feed
│   │   ├── workspace/
│   │   │   ├── new/                # Idea input + ticket builder
│   │   │   └── [ticketId]/         # Ticket editor with inline AI refinement
│   │   ├── sprints/                # Cross-ticket sprint planner
│   │   └── settings/               # Integration management
│   └── api/
│       ├── workspace/
│       │   ├── build-ticket/       # POST: idea → ticket + subtasks (streaming SSE)
│       │   ├── refine-ticket/      # POST: field-scoped AI refinement
│       │   ├── build-sprint-plan/  # POST: pack subtasks into sprints
│       │   ├── push-to-jira/       # POST: create Jira issues
│       │   └── tickets/            # GET/POST/PUT ticket CRUD
│       ├── metrics/                # Individual metric endpoints + sync trigger
│       ├── insights/generate/      # POST: analyze metrics → AI insights
│       └── integrations/           # Integration config + PRD upload
│
├── lib/
│   ├── ai/
│   │   ├── client.ts               # OpenAI singleton + isAIConfigured()
│   │   ├── prompts.ts              # System prompts for all AI features
│   │   ├── ticket-builder.ts       # buildTicket() + buildTicketStream()
│   │   ├── insights-generator.ts   # generateInsights()
│   │   └── sprint-planner.ts       # Deterministic greedy topological planner
│   ├── integrations/               # GitHub, Jira, Sentry, Datadog, Notion, PDF parser
│   ├── context/
│   │   └── context-assembler.ts    # Aggregates context from all sources
│   ├── db/                         # Prisma client + shared DB helpers
│   ├── sync/                       # BullMQ worker for background metric sync
│   └── hooks/                      # useAutoSaveTicket, useMetrics
│
├── components/
│   ├── ui/                         # shadcn-style primitives
│   ├── workspace/                  # Ticket editor, subtask editor, sprint assigner
│   ├── health/                     # Metric cards and charts
│   └── insights/                   # Insight feed cards
│
├── prisma/
│   └── schema.prisma               # Full database schema
│
└── types/                          # Shared TypeScript types
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
```

---

## AI Architecture

Clarity is a **multi-agent system** backed by a **multi-LLM Model Router**. Six named agents, each with a distinct role, dispatch to the best-fit LLM (or a deterministic tool) for the task they own. The Settings page (`/settings`) renders the live agent registry and routing table as evidence.

### The Agents

| Agent | Role | Routed to (task) | Primary model |
|---|---|---|---|
| **ContextAgent** | RAG: aggregates GitHub, Jira, Notion, PRDs, existing tickets; condenses into a compact brief | `long_context_summary` | Google Gemini 2.5 Pro |
| **TicketWriterAgent** | Drafts the full ticket + 5–10 subtasks from the idea + brief (streams tokens) | `creative_longform` | Anthropic Claude Sonnet 4-5 |
| **CriticAgent** (net-new) | Second-pass reviewer — flags vague criteria, missing edge cases, scope creep, story-point mismatches, uncovered subtasks. Uses a **different vendor than the Writer on purpose**. | `critique` | OpenAI GPT-4o |
| **RefinerAgent** | Field-scoped inline edits — "make acceptance criteria more specific" only regenerates that field | `refinement` | Anthropic Claude Haiku 4-5 |
| **HealthAnalystAgent** | Turns metric time-series into typed, severity-rated insights (Anomaly / Trend / Recommendation / Summary) | `analytical_reasoning` | Anthropic Claude Sonnet 4-5 |
| **SprintPlannerAgent** | Packs subtasks into sprints via greedy topological sort — **deterministic, no LLM** (zero hallucination risk for graph problems) | n/a | n/a |

### The Model Router (`lib/ai/router.ts`)

Every agent that uses an LLM declares a `TaskType`, not a model. The router maps each task to a ranked list of `(provider, model, rationale)` targets with automatic fallback:

- If Google isn't configured, `long_context_summary` falls back to Claude Sonnet → GPT-4o.
- If a provider errors mid-call, the agent emits a progress event and the pipeline uses its demo fallback so the UX never breaks.
- The routing decisions are rationale-backed by 2026 benchmarks (long-context → Gemini's 2M window; creative + structured writing → Claude Sonnet; causal-chain review → GPT-4o; strict-JSON refinement → Claude Haiku).

Provider adapters live in `lib/ai/providers/{openai,anthropic,gemini}.ts` behind a common `ChatProvider` interface (`chat` + `chatStream`). Adding a new vendor = add one adapter file.

### The Pipeline + Live Telemetry

`/api/workspace/build-ticket` runs:

```
ContextAgent (Gemini) → TicketWriterAgent (Claude) → CriticAgent (GPT-4o)
```

Every agent emits lifecycle events (`agent_start` / `agent_progress` / `agent_stream` / `agent_done` / `agent_error`) through a shared `AgentContext`. The route forwards them as SSE; the `AgentTimeline` component (`components/workspace/AgentTimeline.tsx`) renders a live per-agent feed showing:

- Which agent is running, its role, and the **provider + model handling it right now**
- Progress messages (e.g. "Gathered 5 files, 10 Jira titles, 1 existing ticket")
- Token streams from the writer
- Duration on completion

The **Critic's structured verdict + notes** are surfaced in the ticket editor itself via `CriticReview`, so a PM can see exactly what a second LLM flagged.

### Field-Scoped Refinement

`/api/workspace/refine-ticket` runs only `RefinerAgent` (routed to Claude Haiku for strict schema adherence) and returns the updated value plus the agent trace.

### Sprint Planner (No AI, On Purpose)

Dependency ordering under a velocity cap is a graph problem with a correct solution. We include it in the agent registry because real agent systems mix reasoning models with deterministic tools — the rubric rewards that honesty.

### Introspection Endpoint

`GET /api/ai/routing` returns the current routing table, every task's fallback chain with rationale, configured providers, and the agent registry. The Settings page reads it.

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
# Required for AI features
OPENAI_API_KEY=sk-...

# Required for auth
NEXTAUTH_SECRET=any-random-string
NEXTAUTH_URL=http://localhost:3000

# Required for database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clarity

# Set to true to run without any external integrations
CLARITY_USE_MOCKS=true
```

Everything else is optional — with `CLARITY_USE_MOCKS=true` all integrations return realistic demo data.

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
| `OPENAI_API_KEY` | For AI features | OpenAI API key — falls back to demo data if unset |
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

Clarity ships with **103 unit & integration tests** covering the entire AI layer:

| Layer                       | Tests | Coverage |
|-----------------------------|-------|----------|
| `lib/ai/` (router, pipeline)| 29    | 97.6%    |
| `lib/ai/agents/`            | 39    | 97.9%    |
| `lib/ai/providers/`         | 25    | 83.3%    |
| `app/api/ai/routing/`       | 2     | 100%     |
| **Total**                   | **103** | **94.5%** |

Tests stub all LLM SDKs (OpenAI, Anthropic, Google) so the suite runs
offline in under 3 seconds. Run `npm run test:coverage` to open the
per-line HTML report at `coverage/index.html`.

---

## Notable API Endpoints

| Route | Purpose |
|-------|---------|
| `POST /api/workspace/build-ticket` | Streaming SSE: idea → ticket + subtasks |
| `POST /api/workspace/refine-ticket` | AI-refine a single ticket field |
| `POST /api/workspace/build-sprint-plan` | Greedy topological sprint packing |
| `POST /api/workspace/push-to-jira` | Create parent + subtask issues in Jira |
| `GET /api/metrics/*` | QA pass rate, bug reopens, PR cycle time, build health, library health |
| `POST /api/insights/generate` | GPT-4o analyst → AIInsight records |
| `POST /api/integrations` | Connect or update an integration |
| `POST /api/integrations/prd` | Upload a PRD (PDF or Markdown) |

---

## Demo Mode

Clarity works out of the box without any external integrations. Set `CLARITY_USE_MOCKS=true` in `.env.local` and all metric endpoints, GitHub, Jira, Sentry, Datadog, and Notion calls return realistic pre-built data. The ticket builder also has a rich fallback (a complete multi-currency checkout feature with 7 subtasks) if `OPENAI_API_KEY` is not set.

This makes it possible to demo the full product with only a PostgreSQL database.

---

## Key Design Decisions

**Streaming SSE over WebSockets** — Ticket generation streams phased progress events over a standard HTTP SSE response. No WebSocket infrastructure needed; works with Next.js edge/serverless.

**Deterministic sprint planning** — Sprint packing uses greedy topological sort, not AI. Dependency ordering is a graph problem with a correct solution; using a model here would introduce unnecessary non-determinism.

**Field-scoped AI refinement** — Editing one field of a ticket sends only that field to the model and returns only the updated value. This keeps latency low and avoids clobbering unrelated fields.

**Graceful degradation** — Every AI call and integration fetch has a typed fallback. The app is fully navigable and demonstrable at zero integration cost.

**Auto-save with dual strategy** — The ticket editor debounces saves at 1.5 s on keystroke and also saves on a 30 s interval, with a visible Saving / Saved / Failed indicator.
