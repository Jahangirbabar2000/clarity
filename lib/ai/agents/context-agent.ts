/**
 * ContextAgent
 *
 * Role: RAG-style context gathering. Pulls from every connected source (GitHub
 * codebase summaries, Jira history, Notion pages, PRD uploads, existing
 * tickets), then optionally runs a Gemini 2.5 Pro pass to condense everything
 * into a compact, writer-ready brief.
 *
 * Why Gemini for the condensation step: 2M-token context + best-in-class
 * long-doc summarization (see 2026 model-routing benchmarks). If Google isn't
 * configured, the router falls back automatically; if no LLM key is set at all,
 * this agent returns the raw assembled context (still fully usable — the
 * writer agent can consume the raw structure directly).
 */

import { assembleContext, type AssembledContext } from "@/lib/context/context-assembler";
import { hasAnyProvider } from "../providers";
import { routeDecision, routeChat, type TaskType } from "../router";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";

export interface ContextAgentOutput {
  raw: AssembledContext;
  /** Condensed natural-language brief when LLM is available; null otherwise. */
  brief: string | null;
}

const TASK: TaskType = "long_context_summary";

const SYSTEM = `You are the Context Agent in Clarity's multi-agent ticket pipeline.
Given a JSON payload of assembled engineering context (codebase files, Jira history, Notion pages, PRDs, existing tickets), produce a concise natural-language brief for the downstream Ticket Writer.

Rules:
- 4–8 short paragraphs, each on one topic (tech stack, relevant services, PRD signals, Jira style cues, duplicates to avoid).
- Reference actual file paths and service names from the context — never invent any.
- No bullet-point soup: prose paragraphs the Writer can scan in under 10 seconds.
- No preamble, no headers, no markdown code fences. Start directly with the first paragraph.`;

function providerLabel(id: "openai" | "anthropic" | "google"): string {
  return id === "openai" ? "OpenAI" : id === "anthropic" ? "Claude" : "Gemini";
}

export const contextAgent: Agent<string, ContextAgentOutput> = {
  name: "ContextAgent",
  role: "Aggregates RAG context from GitHub, Jira, Notion, PRDs, and existing tickets",
  task: TASK,
  async run(orgId: string, ctx: AgentContext): Promise<ContextAgentOutput> {
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
      "Reading your codebase, Jira history, Notion, and PRDs…",
      ctx,
      async () => {
        const raw = await assembleContext(orgId);

        ctx.emit({
          type: "agent_progress",
          agent: this.name,
          message: `Gathered ${raw.relevantFiles.length} files, ${raw.jiraStyleSamples.length} Jira titles, ${raw.sources.existingTickets} existing tickets.`,
        });

        if (!hasAnyProvider()) {
          return { raw, brief: null };
        }

        try {
          const resp = await routeChat({
            task: TASK,
            messages: [
              { role: "system", content: SYSTEM },
              { role: "user", content: JSON.stringify(raw) },
            ],
            maxTokens: 1000,
            temperature: 0.2,
            meta: { agent: this.name, orgId: ctx.orgId ?? orgId },
            onFallback: (failure, next) => {
              ctx.emit({
                type: "agent_progress",
                agent: this.name,
                message: `${providerLabel(failure.target.provider)} ${failure.target.model} failed (${failure.error.message}); retrying with ${providerLabel(next.provider)} ${next.model}…`,
              });
            },
          });
          return { raw, brief: resp.text.trim() };
        } catch (err) {
          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Context condensation failed (${err instanceof Error ? err.message : "unknown"}); passing raw context downstream.`,
          });
          return { raw, brief: null };
        }
      },
    );
  },
};
