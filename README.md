# Clarity

**Clarity** is an AI-powered engineering intelligence platform that turns raw product ideas into production-ready Jira tickets and surfaces real-time engineering health insights — all in one workspace.

---

## What It Does

### AI Product Workspace
Paste a one-sentence feature idea. Clarity assembles context from your connected codebase, Jira history, Notion docs, and uploaded PRDs, then uses GPT-4o to generate:

- A complete ticket with title, description, acceptance criteria, edge cases, and out-of-scope items
- 5–10 subtasks with story point estimates, types, and dependency chains
- A deterministic sprint plan that respects dependencies and velocity constraints
- One-click push to Jira (creates the parent issue and full subtask hierarchy)

Every field is inline-editable with AI-assisted refinement — ask it to "make the acceptance criteria more specific" and only that field regenerates.

### Engineering Health Dashboard
Real-time engineering metrics pulled from GitHub, Jira, Sentry, and Datadog — with GPT-4o-generated insights that flag anomalies, surface trends, and recommend concrete actions:

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

### Ticket Builder (Streaming)
The `/api/workspace/build-ticket` endpoint streams phased SSE events:

```
context → context_ready → generating → chunk (repeated) → done
```

The UI updates in real time: "Reading your codebase…" → "Generating ticket…" → token-by-token output.

### Context Assembly
Before calling GPT-4o, the context assembler pulls from every connected source:
- **GitHub** — recent commits, file summaries, tech stack inference
- **Jira** — recent ticket titles for style matching
- **Notion** — relevant spec/PRD pages
- **PRD uploads** — extracted text from PDF/Markdown files
- **Existing tickets** — to avoid duplicates

All sources are truncated to fit the model's token budget.

### Sprint Planner (No AI)
Sprint planning is intentionally deterministic — a greedy topological sort that respects `dependsOn` constraints and packs subtasks within a velocity cap. Zero hallucination risk, fully explainable output.

### Field-Scoped Refinement
`/api/workspace/refine-ticket` takes a single field name + edit request and returns only the updated value. No full ticket regeneration.

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
```

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
