/**
 * TicketWriterAgent
 *
 * Role: The main creative/structural act. Turns a raw idea + condensed context
 * into a full ticket (title, description, acceptance criteria, edge cases,
 * out-of-scope, type, priority, story points, labels) plus 5–10 subtasks with
 * types, dependencies, and sprint hints.
 *
 * Routed to Claude Sonnet 4 (task = creative_longform) because Sonnet leads
 * 2026 benchmarks on creative + structured long-form writing and schema
 * adherence. GPT-4o fallback is close. Streams tokens so the UI can render
 * progressively.
 */

import { TICKET_BUILDER_SYSTEM_PROMPT } from "../prompts";
import { routeChatStream, routeDecision, type TaskType } from "../router";
import { hasAnyProvider } from "../providers";
import { stripJsonFences } from "../client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";
import type { BuildTicketPayload, GeneratedSubtask, GeneratedTicket } from "@/types/api";
import type { ContextAgentOutput } from "./context-agent";
import type { CritiqueReport } from "./critic-agent";

export interface TicketWriterInput {
  idea: string;
  context: ContextAgentOutput;
  /**
   * When set, the writer is running in *revision mode*: it will rewrite the
   * previous draft to address the Critic's notes instead of starting from
   * scratch. Set by the pipeline's reflection loop.
   */
  revision?: {
    previousDraft: BuildTicketPayload;
    critique: CritiqueReport;
    iteration: number;
  };
}

const REVISION_SYSTEM_ADDENDUM = `

You are now in REVISION MODE. A previous version of this ticket was just reviewed by another agent (the Critic). Your job is to produce a revised draft that directly addresses every blocker and warning the Critic raised, while preserving the parts the Critic did not flag.

Rules for revision mode:
- Output the FULL revised ticket (title, description, acceptanceCriteria, edgeCases, outOfScope, type, priority, storyPoints, suggestedLabels, subtasks) — not a diff.
- For each Critic note, either (a) fix it in the relevant field, or (b) explain in \`description\` why you disagree. Do not silently ignore blockers.
- Do NOT weaken acceptance criteria or delete edge cases to "pass" the Critic. Tighten them instead.
- Keep subtask IDs stable where possible by reusing the same \`title\` when the subtask is unchanged — only rename if the scope genuinely shifted.`;

export const TICKET_WRITER_DEMO_FALLBACK: BuildTicketPayload = {
  ticket: {
    title: "Add multi-currency support to checkout flow",
    description:
      "Expand the checkout flow to support purchases in EUR, GBP, JPY, CAD and AUD in addition to USD. Customers see localized pricing, and backend totals are computed in the selected currency at cart-compute time.\n\nThis integrates with the existing pricing engine in lib/services/pricing.ts and the CheckoutForm wizard. FX rates are sourced from the already-cached FX service (1h TTL). Receipt emails are localized via the existing i18n pipeline.\n\nConstraints: tax recalculation is out of scope. Refund flow must continue to operate in the original transaction currency. Assumption: the supported currency list is fixed to the 5 markets above for v1.",
    acceptanceCriteria: [
      "The user can select a currency from a dropdown in the CheckoutForm header",
      "Given a cart in USD, when the user selects EUR, then all line items and totals re-render in EUR within 200ms",
      "Given a selected currency, when the user reloads, then their selection persists via localStorage",
      "The server computes and stores the transaction in the selected currency on order creation",
      "Given a currency with a stale FX rate (>1h), when checkout is submitted, then a fresh rate is fetched before total confirmation",
      "Receipt emails are sent in the transaction currency with locale-appropriate formatting",
    ],
    edgeCases: [
      "User selects a currency with no available FX rate — fall back to USD and surface a toast",
      "FX service is down — block submission and show a retryable error",
      "Cart contains a bundled item priced only in USD — compute a synthetic per-currency price",
      "User changes currency mid-checkout after payment intent created — require re-confirmation",
    ],
    outOfScope: [
      "Tax recalculation per currency / jurisdiction",
      "Refund flow changes (handled in a separate ticket)",
      "Admin-side reporting currency normalization",
    ],
    type: "FEATURE",
    priority: "HIGH",
    storyPoints: 8,
    suggestedLabels: ["payments", "checkout", "frontend", "backend"],
  },
  subtasks: [
    {
      title: "Add currency selector to CheckoutForm header",
      description:
        "Add a dropdown component to components/CheckoutForm.tsx with the 5 supported currencies. Persist selection in localStorage.",
      type: "FRONTEND",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Extend pricing service with currency-aware totals",
      description:
        "Update lib/services/pricing.ts cartTotals() to accept a target currency and convert line items using the FX service.",
      type: "BACKEND",
      storyPoints: 5,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Add currency column to Order model",
      description:
        "Prisma migration: add `currency String @default(\"USD\")` to Order; backfill existing rows.",
      type: "DATABASE",
      storyPoints: 2,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
    {
      title: "Localize receipt email templates",
      description:
        "Update the receipt template to format amounts using Intl.NumberFormat with the transaction currency and locale.",
      type: "BACKEND",
      storyPoints: 2,
      priority: "MED",
      dependsOn: ["Extend pricing service with currency-aware totals"],
      suggestedSprint: 2,
    },
    {
      title: "Add FX staleness check to checkout handler",
      description:
        "In app/api/checkout/route.ts, re-fetch FX if cached rate is older than 1h before finalizing the order.",
      type: "BACKEND",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: ["Extend pricing service with currency-aware totals"],
      suggestedSprint: 2,
    },
    {
      title: "Regression tests for multi-currency cart totals",
      description:
        "Add unit + integration tests covering currency switch, FX fallback, and bundled-item edge case.",
      type: "TESTING",
      storyPoints: 3,
      priority: "HIGH",
      dependsOn: [
        "Extend pricing service with currency-aware totals",
        "Add currency selector to CheckoutForm header",
      ],
      suggestedSprint: 2,
    },
    {
      title: "Datadog tracing for FX latency",
      description:
        "Add span around FX fetch in checkout handler; alert if p95 > 500ms.",
      type: "INFRA",
      storyPoints: 2,
      priority: "MED",
      dependsOn: ["Add FX staleness check to checkout handler"],
      suggestedSprint: 3,
    },
  ],
};

const TASK: TaskType = "creative_longform";

/** Build the user-message payload handed to the writer model. */
function buildUserPayload(input: TicketWriterInput): string {
  const base: Record<string, unknown> = {
    idea: input.idea,
    brief: input.context.brief,
    context: input.context.raw,
  };
  if (input.revision) {
    base.mode = "revision";
    base.revisionIteration = input.revision.iteration;
    base.previousDraft = input.revision.previousDraft;
    base.criticNotes = input.revision.critique.notes;
    base.criticVerdict = input.revision.critique.verdict;
    base.criticSummary = input.revision.critique.summary;
  }
  return JSON.stringify(base);
}

export const ticketWriterAgent: Agent<TicketWriterInput, BuildTicketPayload> = {
  name: "TicketWriterAgent",
  role: "Drafts the full ticket + subtasks from idea + context brief",
  task: TASK,
  async run(input: TicketWriterInput, ctx: AgentContext): Promise<BuildTicketPayload> {
    let target: { provider: "openai" | "anthropic" | "google"; model: string } | null = null;
    if (hasAnyProvider()) {
      try {
        target = routeDecision(TASK).target;
      } catch {
        target = null;
      }
    }

    const revisionLabel = input.revision ? ` (revision ${input.revision.iteration})` : "";
    return runAgent(
      this,
      target,
      target
        ? `Writing ticket${revisionLabel} with ${providerLabel(target.provider)} ${target.model}…`
        : `No LLM configured — using demo fallback ticket${revisionLabel}…`,
      ctx,
      async () => {
        if (!hasAnyProvider()) {
          const demoText = JSON.stringify(TICKET_WRITER_DEMO_FALLBACK, null, 2);
          for (let i = 0; i < demoText.length; i += 64) {
            ctx.emit({
              type: "agent_stream",
              agent: this.name,
              text: demoText.slice(i, i + 64),
            });
            await new Promise((r) => setTimeout(r, 10));
          }
          return TICKET_WRITER_DEMO_FALLBACK;
        }

        const systemPrompt = input.revision
          ? TICKET_BUILDER_SYSTEM_PROMPT + REVISION_SYSTEM_ADDENDUM
          : TICKET_BUILDER_SYSTEM_PROMPT;

        let full = "";
        try {
          const resp = await routeChatStream(
            {
              task: TASK,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: buildUserPayload(input) },
              ],
              maxTokens: 4000,
              temperature: 0.4,
              meta: { agent: this.name, orgId: ctx.orgId },
              onFallback: (failure, next) => {
                ctx.emit({
                  type: "agent_progress",
                  agent: this.name,
                  message: `${providerLabel(failure.target.provider)} ${failure.target.model} failed (${failure.error.message}); falling back to ${providerLabel(next.provider)} ${next.model}…`,
                });
              },
            },
            (delta) => {
              full += delta;
              ctx.emit({ type: "agent_stream", agent: this.name, text: delta });
            },
          );
          try {
            return JSON.parse(stripJsonFences(resp.text || full)) as BuildTicketPayload;
          } catch {
            ctx.emit({
              type: "agent_progress",
              agent: this.name,
              message: "Writer output was not valid JSON; using demo fallback.",
            });
            return TICKET_WRITER_DEMO_FALLBACK;
          }
        } catch (err) {
          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Writer call failed (${err instanceof Error ? err.message : "unknown"}); using demo fallback.`,
          });
          return TICKET_WRITER_DEMO_FALLBACK;
        }
      },
    );
  },
};

function providerLabel(id: "openai" | "anthropic" | "google"): string {
  return id === "openai" ? "OpenAI" : id === "anthropic" ? "Claude" : "Gemini";
}

export type { GeneratedTicket, GeneratedSubtask };
