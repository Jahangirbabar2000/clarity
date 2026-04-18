/**
 * CriticAgent (net-new)
 *
 * Role: Second-pass quality reviewer. Takes the TicketWriter's draft and looks
 * for:
 *   - Vague acceptance criteria ("the feature works correctly")
 *   - Missing edge cases relevant to the described system
 *   - Ambiguous scope where outOfScope should be tightened
 *   - Story point estimates that don't match described complexity
 *   - Duplicates with existing tickets (grounded via `listExistingTicketTitles`)
 *   - Unusual subtask-type distributions (via `getSubtaskTypeDistribution`)
 *
 * Routed to OpenAI GPT-4o (task = "critique") because GPT-4o leads 2026
 * benchmarks on step-by-step causal analysis and actionable-fix style — ideal
 * for a reviewer role. This explicitly demonstrates cross-vendor routing: a
 * different LLM than the Writer, on purpose.
 *
 * When OpenAI is configured, the Critic uses native function/tool calling so
 * its judgments are grounded in real org data (e.g. existing ticket titles)
 * instead of guessed from the draft alone. When OpenAI isn't configured, the
 * Critic falls back to a plain `routeChat` with no tools — still functional,
 * just less grounded.
 *
 * Output: a structured critique (not a rewritten ticket). The pipeline attaches
 * the critique to the ticket's `contextSources` metadata and surfaces it in the
 * UI so a PM can see what the Critic flagged.
 */

import { routeChat, routeDecision, type TaskType } from "../router";
import { hasAnyProvider, providers } from "../providers";
import { stripJsonFences } from "../client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";
import type { BuildTicketPayload } from "@/types/api";
import {
  CRITIC_TOOLS_BY_NAME,
  criticToolsAsOpenAISchema,
} from "../tools/critic-tools";
import { openaiChatWithTools, type ToolCallRecord } from "../providers/openai-tools";
import { recordModelCall } from "../usage";

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
  /**
   * If tool use was invoked (OpenAI path), this lists each tool call the
   * Critic made while forming its judgment — useful for the UI to surface
   * "critic consulted existing tickets" and for grading visibility.
   */
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    resultPreview: string;
    durationMs: number;
    error?: string;
  }>;
}

const TASK: TaskType = "critique";

const SYSTEM_NO_TOOLS = `You are the Critic Agent in Clarity's multi-agent ticket pipeline.
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

const SYSTEM_WITH_TOOLS = `${SYSTEM_NO_TOOLS}

TOOLS AVAILABLE:
You have access to two tools. Prefer calling them once each before forming your critique:

1. listExistingTicketTitles() — returns recent ticket titles already in this org. Use to flag drafts that duplicate existing work. If a very similar title exists, raise a "blocker" note on the "title" field.
2. getSubtaskTypeDistribution() — returns the org's typical subtask-type distribution. If the current draft's subtask mix is wildly different (e.g. 0 TESTING when the org usually has 20%+), raise a "warning" note on "subtasks".

Call each tool AT MOST once. After gathering evidence, emit your final JSON critique and stop. Do NOT include tool reasoning in the critique; only the final JSON.`;

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

        // Prefer the tool-calling path when OpenAI is the chosen provider —
        // it lets the Critic ground judgments in actual org data (duplicate
        // tickets, subtask-type skew) instead of guessing from the draft alone.
        if (target?.provider === "openai" && providers.openai.isConfigured()) {
          try {
            return await runWithTools(draft, ctx, target.model, this.name);
          } catch (err) {
            ctx.emit({
              type: "agent_progress",
              agent: this.name,
              message: `Tool-use path failed (${err instanceof Error ? err.message : "unknown"}); falling back to plain chat.`,
            });
            // Fall through to the plain routeChat below.
          }
        }

        try {
          const resp = await routeChat({
            task: TASK,
            messages: [
              { role: "system", content: SYSTEM_NO_TOOLS },
              { role: "user", content: JSON.stringify(draft) },
            ],
            maxTokens: 1200,
            temperature: 0.3,
            meta: { agent: this.name, orgId: ctx.orgId },
            onFallback: (failure, next) => {
              ctx.emit({
                type: "agent_progress",
                agent: this.name,
                message: `${providerLabel(failure.target.provider)} ${failure.target.model} failed (${failure.error.message}); retrying with ${providerLabel(next.provider)} ${next.model}…`,
              });
            },
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

/**
 * Tool-calling path. Streams tool invocations to the UI as agent_progress
 * events and records one ModelCall ledger entry capturing the *entire*
 * multi-turn conversation's aggregate usage.
 */
async function runWithTools(
  draft: BuildTicketPayload,
  ctx: AgentContext,
  model: string,
  agentName: string,
): Promise<CritiqueReport> {
  const startedAt = Date.now();
  const executor = async (name: string, args: Record<string, unknown>) => {
    const tool = CRITIC_TOOLS_BY_NAME[name];
    if (!tool) throw new Error(`unknown tool: ${name}`);
    return tool.execute(args, { orgId: ctx.orgId });
  };

  let caughtError: Error | null = null;
  let result: Awaited<ReturnType<typeof openaiChatWithTools>> | null = null;

  try {
    result = await openaiChatWithTools({
      model,
      messages: [
        { role: "system", content: SYSTEM_WITH_TOOLS },
        { role: "user", content: JSON.stringify(draft) },
      ],
      tools: criticToolsAsOpenAISchema(),
      executor,
      maxTokens: 1200,
      temperature: 0.3,
      onToolCall: (record: ToolCallRecord) => {
        ctx.emit({
          type: "agent_progress",
          agent: agentName,
          message: record.error
            ? `Tool ${record.name} failed: ${record.error}`
            : `Called tool ${record.name}(${Object.keys(record.args).length ? JSON.stringify(record.args) : ""}) → ${record.resultPreview.slice(0, 120)}${record.resultPreview.length > 120 ? "…" : ""}`,
        });
      },
    });
  } catch (err) {
    caughtError = err instanceof Error ? err : new Error(String(err));
  }

  // Record the aggregate OpenAI call to the usage ledger regardless of outcome.
  void recordModelCall({
    orgId: ctx.orgId,
    agent: agentName,
    task: TASK,
    provider: "openai",
    model,
    inputTokens: result?.usage?.inputTokens,
    outputTokens: result?.usage?.outputTokens,
    durationMs: Date.now() - startedAt,
    success: !caughtError,
    errorMessage: caughtError?.message,
  });

  if (caughtError || !result) {
    throw caughtError ?? new Error("tool-use path produced no result");
  }

  try {
    const parsed = JSON.parse(stripJsonFences(result.text)) as CritiqueReport;
    if (!parsed || !parsed.verdict || !Array.isArray(parsed.notes)) {
      ctx.emit({
        type: "agent_progress",
        agent: agentName,
        message: "Critic tool-use output had unexpected shape; using fallback critique.",
      });
      return { ...FALLBACK_CRITIQUE, toolCalls: result.toolCalls };
    }
    ctx.emit({
      type: "agent_progress",
      agent: agentName,
      message: `Verdict: ${parsed.verdict}. ${parsed.notes.length} note${parsed.notes.length === 1 ? "" : "s"}. ${result.toolCalls.length} tool call${result.toolCalls.length === 1 ? "" : "s"}.`,
    });
    return { ...parsed, toolCalls: result.toolCalls };
  } catch {
    return { ...FALLBACK_CRITIQUE, toolCalls: result.toolCalls };
  }
}
