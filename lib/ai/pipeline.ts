/**
 * Ticket-building pipeline orchestrator with agent reflection loop.
 *
 * Pass 1 (always):
 *   1. ContextAgent       (Gemini 2.5 Pro)  — RAG + long-context summary
 *   2. TicketWriterAgent  (Claude Sonnet)   — creative long-form draft
 *   3. CriticAgent        (GPT-4o)          — structured critique
 *
 * Reflection (if Critic verdict === "needs_revision"):
 *   4. TicketWriterAgent  (Claude Sonnet)   — revises draft to address notes
 *   5. CriticAgent        (GPT-4o)          — re-reviews the revision
 *   …up to `maxReflections` extra rounds. Loop exits as soon as the Critic
 *   stops demanding revisions, or when the iteration budget is exhausted.
 *
 * This is the core "agentic" behavior: one agent's output becomes another's
 * input, and the pipeline iterates until quality converges. Every step
 * (including reflection rounds) emits lifecycle events through the shared
 * AgentContext so the UI can render the iterative loop live.
 */

import {
  contextAgent,
  ticketWriterAgent,
  criticAgent,
  type AgentEvent,
  type ContextAgentOutput,
} from "./agents";
import type { BuildTicketPayload } from "@/types/api";
import type { CritiqueReport } from "./agents/critic-agent";

export interface BuildTicketPipelineResult {
  context: ContextAgentOutput;
  draft: BuildTicketPayload;
  critique: CritiqueReport;
  /**
   * How many Writer→Critic passes ran. 1 = Critic approved first draft, no
   * revision needed. 2+ = reflection loop triggered at least one revision.
   */
  iterations: number;
  /**
   * History of every critique produced during the run, oldest first. Length
   * always equals `iterations`. Useful for the UI to show how the draft
   * evolved across the loop.
   */
  critiqueHistory: CritiqueReport[];
}

export interface BuildPipelineOptions {
  /** Max number of *extra* Writer→Critic passes beyond the initial one. */
  maxReflections?: number;
}

const DEFAULT_MAX_REFLECTIONS = 2;

export async function runBuildTicketPipeline(
  idea: string,
  orgId: string,
  emit: (event: AgentEvent) => void,
  options: BuildPipelineOptions = {},
): Promise<BuildTicketPipelineResult> {
  const maxReflections = options.maxReflections ?? DEFAULT_MAX_REFLECTIONS;
  const maxIterations = maxReflections + 1;
  const ctx = { emit, orgId, idea };

  const context = await contextAgent.run(orgId, ctx);
  let draft = await ticketWriterAgent.run({ idea, context }, ctx);
  let critique = await criticAgent.run(draft, ctx);

  let iteration = 1;
  const critiqueHistory: CritiqueReport[] = [critique];

  while (critique.verdict === "needs_revision" && iteration <= maxReflections) {
    iteration += 1;
    const blockers = critique.notes.filter((n) => n.severity === "blocker").length;
    const warnings = critique.notes.filter((n) => n.severity === "warning").length;
    emit({
      type: "reflection",
      iteration,
      maxIterations,
      verdict: critique.verdict,
      message:
        `Critic flagged ${blockers} blocker${blockers === 1 ? "" : "s"} and ${warnings} warning${warnings === 1 ? "" : "s"} — ` +
        `asking Writer to revise (iteration ${iteration}/${maxIterations}).`,
    });
    draft = await ticketWriterAgent.run(
      { idea, context, revision: { previousDraft: draft, critique, iteration } },
      ctx,
    );
    critique = await criticAgent.run(draft, ctx);
    critiqueHistory.push(critique);
  }

  if (iteration > 1) {
    emit({
      type: "reflection",
      iteration,
      maxIterations,
      verdict: critique.verdict,
      message:
        critique.verdict === "needs_revision"
          ? `Reflection budget exhausted after ${iteration} iterations. Final verdict: still needs_revision — surfacing the last draft anyway.`
          : `Reflection loop converged after ${iteration} iterations. Final verdict: ${critique.verdict}.`,
    });
  }

  return { context, draft, critique, iterations: iteration, critiqueHistory };
}
