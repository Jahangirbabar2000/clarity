/**
 * CriticAgent (net-new)
 *
 * Role: Second-pass quality reviewer. Takes the TicketWriter's draft and looks
 * for:
 *   - Vague acceptance criteria ("the feature works correctly")
 *   - Missing edge cases relevant to the described system
 *   - Ambiguous scope where outOfScope should be tightened
 *   - Story point estimates that don't match described complexity
 *
 * Routed to OpenAI GPT-4o (task = "critique") because GPT-4o leads 2026
 * benchmarks on step-by-step causal analysis and actionable-fix style — ideal
 * for a reviewer role. This explicitly demonstrates cross-vendor routing: a
 * different LLM than the Writer, on purpose.
 *
 * Output: a structured critique (not a rewritten ticket). The pipeline attaches
 * the critique to the ticket's `contextSources` metadata and surfaces it in the
 * UI so a PM can see what the Critic flagged.
 */

import { routeChat, routeDecision, type TaskType } from "../router";
import { hasAnyProvider } from "../providers";
import { stripJsonFences } from "../client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";
import type { BuildTicketPayload } from "@/types/api";

export type CritiqueSeverity = "info" | "warning" | "blocker";

export interface CritiqueNote {
  field:
    | "title"
    | "description"
    | "acceptanceCriteria"
    | "edgeCases"
    | "outOfScope"
    | "storyPoints"
    | "subtasks"
    | "general";
  severity: CritiqueSeverity;
  message: string;
  suggestion?: string;
}

export interface CritiqueReport {
  verdict: "approved" | "approved_with_notes" | "needs_revision";
  summary: string;
  notes: CritiqueNote[];
}

const TASK: TaskType = "critique";

const SYSTEM = `You are the Critic Agent in Clarity's multi-agent ticket pipeline.
Another agent (the Writer) has just drafted a Jira-style ticket. Your job is to review that draft with a senior engineering manager's eye and return a structured critique.

Review for:
1. Vague or untestable acceptance criteria ("the feature works correctly", "performance is good")
2. Missing edge cases a senior engineer would catch (concurrency, auth, rate limits, failure modes, data migration, backwards compat)
3. Ambiguous scope — scope creep that should be moved to outOfScope
4. Story point estimate that obviously doesn't match the described complexity
5. Subtask coverage — does any acceptance criterion have no implementing subtask?

Output JSON with exact shape:
{
  "verdict": "approved" | "approved_with_notes" | "needs_revision",
  "summary": "one-sentence overall assessment",
  "notes": [
    { "field": "acceptanceCriteria" | "edgeCases" | "outOfScope" | "description" | "title" | "storyPoints" | "subtasks" | "general",
      "severity": "info" | "warning" | "blocker",
      "message": "what is wrong or missing",
      "suggestion": "concrete fix (optional)" }
  ]
}

Rules:
- Return 2–6 notes. Not 0, not 20.
- Only flag things a real senior reviewer would flag — do not nitpick style.
- If the draft is genuinely solid, set verdict="approved_with_notes" with 2–3 low-severity polish suggestions. Do NOT say "approved" with zero notes.
- Return ONLY valid JSON. No markdown, no preamble.`;

const FALLBACK_CRITIQUE: CritiqueReport = {
  verdict: "approved_with_notes",
  summary: "Draft is workable; a few acceptance criteria could be tightened and one edge case is implied but not explicit.",
  notes: [
    {
      field: "acceptanceCriteria",
      severity: "info",
      message: "Consider adding a latency bound to the main happy-path criterion.",
      suggestion: "e.g. '…within 200ms p95'.",
    },
    {
      field: "edgeCases",
      severity: "warning",
      message: "Downstream dependency failure mode is not called out.",
      suggestion: "Add an edge case for the external service returning 5xx and define the user-facing behavior.",
    },
  ],
};

export const criticAgent: Agent<BuildTicketPayload, CritiqueReport> = {
  name: "CriticAgent",
  role: "Reviews the draft ticket for gaps, ambiguity, and missing edge cases",
  task: TASK,
  async run(draft: BuildTicketPayload, ctx: AgentContext): Promise<CritiqueReport> {
    let target: { provider: "openai" | "anthropic" | "google"; model: string } | null = null;
    if (hasAnyProvider()) {
      try {
        target = routeDecision(TASK).target;
      } catch {
        target = null;
      }
    }

    return runAgent(
      this,
      target,
      target
        ? `Reviewing draft with ${providerLabel(target.provider)} ${target.model}…`
        : "No LLM configured — using pre-built critique stub…",
      ctx,
      async () => {
        if (!hasAnyProvider()) {
          return FALLBACK_CRITIQUE;
        }

        try {
          const resp = await routeChat({
            task: TASK,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: JSON.stringify(draft) },
            ],
            maxTokens: 1200,
            temperature: 0.3,
          });

          const parsed = JSON.parse(stripJsonFences(resp.text)) as CritiqueReport;

          // Light validation — if the shape is broken, fall back rather than crash the pipeline
          if (!parsed || !parsed.verdict || !Array.isArray(parsed.notes)) {
            ctx.emit({
              type: "agent_progress",
              agent: this.name,
              message: "Critic output had unexpected shape; using fallback critique.",
            });
            return FALLBACK_CRITIQUE;
          }

          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Verdict: ${parsed.verdict}. ${parsed.notes.length} note${parsed.notes.length === 1 ? "" : "s"}.`,
          });

          return parsed;
        } catch (err) {
          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Critic call failed (${err instanceof Error ? err.message : "unknown"}); using fallback critique.`,
          });
          return FALLBACK_CRITIQUE;
        }
      },
    );
  },
};

function providerLabel(id: "openai" | "anthropic" | "google"): string {
  return id === "openai" ? "OpenAI" : id === "anthropic" ? "Claude" : "Gemini";
}
