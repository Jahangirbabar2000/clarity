/**
 * Clarity — Public landing page.
 *
 * Structure follows a classic high-conversion layout (hero → social proof →
 * features/benefits → how-it-works → routing preview → FAQ → final CTA →
 * footer) adapted for a technical audience: the value prop is about multi-
 * agent architecture and transparent LLM routing, not SaaS platitudes.
 */

import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Github,
  Bot,
  Brain,
  Network,
  Activity,
  FileSearch,
  ShieldCheck,
  Layers,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Clarity — Multi-agent AI for engineering teams",
  description:
    "Six specialized AI agents, routed across OpenAI, Anthropic, and Google, turn one-line product ideas into repo-grounded, sprint-ready Jira tickets.",
};

const GITHUB_URL = "https://github.com/AashutoshAgrawal/clarity";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <GridBackground />

      <TopNav />

      <Hero />

      <SocialProofBar />

      <HowItWorks />

      <Features />

      <RoutingPreview />

      <Stats />

      <FAQ />

      <FinalCTA />

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top nav                                                            */
/* ------------------------------------------------------------------ */

function TopNav() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <span>Clarity</span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
        <a href="#how" className="hover:text-foreground">How it works</a>
        <a href="#features" className="hover:text-foreground">Features</a>
        <a href="#routing" className="hover:text-foreground">Routing</a>
        <a href="#faq" className="hover:text-foreground">FAQ</a>
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href={GITHUB_URL}
          target="_blank"
          className="hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex"
        >
          <Github className="h-3.5 w-3.5" />
          GitHub
        </Link>
        <Link href="/overview">
          <Button size="sm">
            Try it live <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 md:pb-24 md:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Six agents · three LLMs · one workspace
          </div>

          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            From a one-line idea to a{" "}
            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent dark:from-slate-50 dark:via-slate-300 dark:to-slate-50">
              Jira-ready ticket
            </span>{" "}
            — in seconds.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            Clarity orchestrates six specialized AI agents across OpenAI,
            Anthropic, and Google Gemini to gather context from your repo,
            draft the ticket, critique it, and plan the sprint — while you
            watch every model call stream in live.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/overview">
              <Button size="lg" className="h-11 px-5 text-base">
                Launch Clarity <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={GITHUB_URL} target="_blank">
              <Button size="lg" variant="outline" className="h-11 px-5 text-base">
                <Github className="h-4 w-4" /> View source
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-5 pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> 103 tests · 94.5% coverage
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Network className="h-3.5 w-3.5" /> Works with any 1 of 3 vendors
            </span>
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}

/**
 * A static replica of the AgentTimeline component the user sees in the app.
 * We deliberately mirror the real UI (icons, provider dots, duration pills)
 * so the hero visual is a faithful preview of the product, not marketing art.
 */
function HeroVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-slate-200/40 via-transparent to-slate-300/40 blur-2xl dark:from-slate-800/40 dark:to-slate-700/30" />
      <div className="rounded-xl border bg-card/80 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Agent activity</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            build-ticket · 14.3s
          </span>
        </div>
        <div className="p-5">
          <ol className="relative ml-2 space-y-4 border-l border-border pl-5">
            <HeroStep
              status="done"
              name="ContextAgent"
              role="Gathers repo + Jira + Notion + PRD context"
              provider="google"
              model="gemini-2.5-pro"
              duration="3.2s"
              note="42 files · 8 Jira samples · 1 PRD"
            />
            <HeroStep
              status="done"
              name="TicketWriterAgent"
              role="Drafts ticket + subtasks"
              provider="anthropic"
              model="claude-sonnet-4-5"
              duration="8.6s"
              note="streaming 312 tokens"
            />
            <HeroStep
              status="running"
              name="CriticAgent"
              role="Reviews draft for gaps + vagueness"
              provider="openai"
              model="gpt-4o"
              note="verdict: needs_revision (2 notes)"
            />
            <HeroStep
              status="pending"
              name="SprintPlannerAgent"
              role="Packs subtasks into sprints by dependency"
              provider={null}
              model="deterministic"
            />
          </ol>
        </div>
      </div>
    </div>
  );
}

function HeroStep({
  status,
  name,
  role,
  provider,
  model,
  duration,
  note,
}: {
  status: "done" | "running" | "pending";
  name: string;
  role: string;
  provider: "openai" | "anthropic" | "google" | null;
  model: string;
  duration?: string;
  note?: string;
}) {
  const dot =
    provider === "openai"
      ? "bg-emerald-500"
      : provider === "anthropic"
        ? "bg-orange-500"
        : provider === "google"
          ? "bg-sky-500"
          : "bg-muted-foreground/40";
  const providerLabel =
    provider === "openai"
      ? "OpenAI"
      : provider === "anthropic"
        ? "Anthropic"
        : provider === "google"
          ? "Google"
          : null;
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border bg-background">
        {status === "running" ? (
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        ) : status === "done" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
        )}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {providerLabel ? (
            <>
              {providerLabel} · {model}
            </>
          ) : (
            <>
              <Brain className="h-3 w-3" /> {model}
            </>
          )}
        </span>
        {duration ? (
          <span className="text-[11px] text-muted-foreground">{duration}</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">{role}</p>
      {note ? <p className="mt-1 text-[11px]">→ {note}</p> : null}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Social proof bar                                                   */
/* ------------------------------------------------------------------ */

function SocialProofBar() {
  return (
    <section className="border-y bg-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 md:flex-row md:justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Powered by the best of every lab
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ProviderBadge provider="openai" name="OpenAI" model="GPT-4o" />
          <ProviderBadge
            provider="anthropic"
            name="Anthropic"
            model="Claude Sonnet 4.5"
          />
          <ProviderBadge
            provider="google"
            name="Google"
            model="Gemini 2.5 Pro"
          />
        </div>
      </div>
    </section>
  );
}

function ProviderBadge({
  provider,
  name,
  model,
}: {
  provider: "openai" | "anthropic" | "google";
  name: string;
  model: string;
}) {
  const dot =
    provider === "openai"
      ? "bg-emerald-500"
      : provider === "anthropic"
        ? "bg-orange-500"
        : "bg-sky-500";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="font-medium">{name}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{model}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* How it works — explains the value creation (per landing-page guide)*/
/* ------------------------------------------------------------------ */

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        eyebrow="How it works"
        title="From idea to sprint in three steps"
        subtitle="You describe what you want. Clarity handles the rest — with every LLM call visible in real time."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Step
          n={1}
          title="Describe a feature in one line"
          body="Type a one-sentence idea. No template, no rubric — just plain English."
          icon={Sparkles}
        />
        <Step
          n={2}
          title="Agents gather, draft, and critique"
          body="ContextAgent pulls from your repo, Jira, Notion, and PRDs. Writer drafts. Critic reviews. All streamed live."
          icon={Bot}
        />
        <Step
          n={3}
          title="Edit, plan, push to Jira"
          body="Refine any field with AI, auto-plan into sprints by dependency, and push parent + subtasks to Jira."
          icon={Layers}
        />
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  icon: Icon,
}: {
  n: number;
  title: string;
  body: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-muted/50">
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            0{n}
          </span>
        </div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Features & benefits                                                */
/* ------------------------------------------------------------------ */

function Features() {
  return (
    <section id="features" className="relative border-y bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <SectionHeader
          eyebrow="What you get"
          title="A serious multi-agent system, not a wrapper"
          subtitle="Every capability is a first-class agent with a specific role and a specific model — picked by the router for the task, not by whoever signed the biggest OpenAI contract."
        />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={Bot}
            title="Six specialized agents"
            body="Context, Writer, Critic, Refiner, Sprint Planner, Health Analyst — each with a distinct role, prompt, and model."
          />
          <Feature
            icon={Network}
            title="Multi-LLM intelligent routing"
            body="A task-based routing table maps six task types to the best-fit model. Fallbacks let the app run with any single vendor key."
          />
          <Feature
            icon={FileSearch}
            title="Repo-grounded context"
            body="ContextAgent RAGs over GitHub, Jira, Notion, and uploaded PRDs so tickets are grounded in your actual codebase."
          />
          <Feature
            icon={Activity}
            title="Live agent telemetry"
            body="Every agent event streams over SSE into a live timeline — you see which model ran, how long it took, and what it said."
          />
          <Feature
            icon={ShieldCheck}
            title="Structured second-pass critique"
            body="CriticAgent reviews the draft for vagueness, missing edge cases, and story-point mismatches — with field-scoped notes."
          />
          <Feature
            icon={Layers}
            title="Dependency-aware sprint planning"
            body="A deterministic topological packer turns subtasks + dependencies into a sprint plan that respects your velocity."
          />
        </div>
      </div>
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-xl border bg-card p-6 transition-colors hover:border-foreground/20">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 text-base font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Routing table preview — unique proof of the architecture           */
/* ------------------------------------------------------------------ */

const ROUTING_PREVIEW: {
  task: string;
  use: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  why: string;
}[] = [
  {
    task: "long_context_summary",
    use: "Condense repo, Jira, Notion, PRD",
    provider: "google",
    model: "gemini-2.5-pro",
    why: "2M-token context window",
  },
  {
    task: "creative_longform",
    use: "Draft ticket + subtasks",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    why: "Leads on structured long-form writing",
  },
  {
    task: "critique",
    use: "Review the draft",
    provider: "openai",
    model: "gpt-4o",
    why: "Best causal-chain analysis",
  },
  {
    task: "refinement",
    use: "Edit a single field",
    provider: "anthropic",
    model: "claude-haiku-4-5",
    why: "Top JSON-schema adherence, cheap",
  },
  {
    task: "analytical_reasoning",
    use: "Health insights from metrics",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    why: "Strongest at multi-metric inference",
  },
  {
    task: "classification",
    use: "Tag / label / categorize",
    provider: "google",
    model: "gemini-2.5-flash",
    why: "Cheapest & fastest tier",
  },
];

function RoutingPreview() {
  return (
    <section id="routing" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <SectionHeader
        eyebrow="The routing table"
        title="The right model for every task"
        subtitle="Clarity picks models by published benchmark strengths, not by habit. If a preferred provider isn't configured, the router falls back down a chain — so the app works with any one of the three API keys."
      />

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[1.2fr_1.5fr_1.8fr_2fr] gap-4 border-b bg-muted/50 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid">
          <div>Task</div>
          <div>Used for</div>
          <div>Chosen model</div>
          <div>Why</div>
        </div>
        <div className="divide-y">
          {ROUTING_PREVIEW.map((r) => (
            <div
              key={r.task}
              className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[1.2fr_1.5fr_1.8fr_2fr] md:gap-4"
            >
              <code className="font-mono text-xs text-muted-foreground">
                {r.task}
              </code>
              <div className="text-sm">{r.use}</div>
              <div>
                <ProviderBadge
                  provider={r.provider}
                  name={
                    r.provider === "openai"
                      ? "OpenAI"
                      : r.provider === "anthropic"
                        ? "Anthropic"
                        : "Google"
                  }
                  model={r.model}
                />
              </div>
              <div className="text-xs text-muted-foreground">{r.why}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Full table + fallback chains available in{" "}
        <Link href="/settings" className="underline hover:text-foreground">
          Settings → AI Routing
        </Link>
        .
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Stats (additional social proof)                                    */
/* ------------------------------------------------------------------ */

function Stats() {
  return (
    <section className="border-y bg-muted/20">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-14 md:grid-cols-4">
        <Stat value="6" label="Specialized agents" />
        <Stat value="3" label="LLM providers" />
        <Stat value="103" label="Unit & integration tests" />
        <Stat value="94.5%" label="AI-layer test coverage" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1 text-center">
      <div className="text-4xl font-semibold tracking-tight md:text-5xl">
        {value}
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ — handles objections                                           */
/* ------------------------------------------------------------------ */

const FAQS = [
  {
    q: "Do I need all three API keys?",
    a: "No. Clarity runs with any one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY. The router automatically falls back down the preference chain, so single-vendor mode still works — you just miss out on benchmark-picked routing.",
  },
  {
    q: "Is my code or data sent to LLMs?",
    a: "Only context snippets are sent — file paths, short summaries, recent Jira titles, PRD excerpts. Full file contents are never uploaded. The CriticAgent only sees the drafted ticket, not raw repo data.",
  },
  {
    q: "Can I use Clarity without Jira or GitHub?",
    a: "Yes. Integrations are optional and configurable per workspace. You can explore every surface without any connected account — just sign in with GitHub and start from the workspace.",
  },
  {
    q: "How is this different from Cursor, v0, or Copilot?",
    a: "Those are generalist code assistants. Clarity is a task-specific multi-agent system for product/engineering planning — it stops at the ticket boundary and optimizes for repo-grounded drafts, second-pass critique, and sprint packing rather than line-by-line code generation.",
  },
  {
    q: "Is it open source?",
    a: (
      <>
        Yes — the full source is on{" "}
        <Link
          href={GITHUB_URL}
          target="_blank"
          className="underline hover:text-foreground"
        >
          GitHub
        </Link>
        . Built for Northeastern&apos;s Applied Generative AI final project.
      </>
    ),
  },
];

function FAQ() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-20 md:py-28">
      <SectionHeader
        eyebrow="FAQ"
        title="Questions you probably have"
        subtitle={null}
      />

      <div className="space-y-3">
        {FAQS.map((f, i) => (
          <details
            key={i}
            className="group rounded-lg border bg-card px-5 py-4 transition-colors open:border-foreground/20"
          >
            <summary className="flex cursor-pointer items-center justify-between text-sm font-medium">
              {f.q}
              <span className="text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-50 to-slate-100 p-10 text-center dark:from-slate-900 dark:to-slate-800 md:p-16">
        <div className="relative z-10 space-y-5">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
            See six agents collaborate on your next ticket.
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Sign in with GitHub and connect your integrations. Watch Gemini, Claude, and GPT-4o collaborate on your real tickets in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/login">
              <Button size="lg" className="h-11 px-6 text-base">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={GITHUB_URL} target="_blank">
              <Button size="lg" variant="outline" className="h-11 px-6 text-base">
                <Github className="h-4 w-4" /> Read the source
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-sm text-muted-foreground md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <Sparkles className="h-3 w-3" />
          </div>
          <span className="font-medium text-foreground">Clarity</span>
          <span>·</span>
          <span>Applied GenAI · Northeastern · 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-foreground">Sign in</Link>
          <Link href="/settings" className="hover:text-foreground">Settings</Link>
          <Link href={GITHUB_URL} target="_blank" className="hover:text-foreground">
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                        */
/* ------------------------------------------------------------------ */

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string | null;
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function GridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(148,163,184,0.15),transparent_55%)]"
    >
      <div
        className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse at top, black 40%, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at top, black 40%, transparent 75%)",
        }}
      />
    </div>
  );
}
