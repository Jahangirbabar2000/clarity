/**
 * Ticket-building pipeline orchestrator.
 *
 * Runs three agents in sequence:
 *
 *   1. ContextAgent    (Gemini 2.5 Pro)    — RAG + long-context summary
 *   2. TicketWriterAgent (Claude Sonnet)  — creative long-form draft
 *   3. CriticAgent       (GPT-4o)          — structured critique
 *
 * Every step emits lifecycle events through the shared AgentContext. Callers
 * (e.g. the SSE route) forward those events to the client so the UI can show
 * a live per-agent timeline with provider/model labels — the clearest possible
 * demonstration of the multi-agent + multi-LLM architecture.
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
}

export async function runBuildTicketPipeline(
  idea: string,
  orgId: string,
  emit: (event: AgentEvent) => void,
): Promise<BuildTicketPipelineResult> {
  const ctx = { emit };

  const context = await contextAgent.run(orgId, ctx);
  const draft = await ticketWriterAgent.run({ idea, context }, ctx);
  const critique = await criticAgent.run(draft, ctx);

  return { context, draft, critique };
}
