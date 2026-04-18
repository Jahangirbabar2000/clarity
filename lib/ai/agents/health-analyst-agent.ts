/**
 * HealthAnalystAgent
 *
 * Role: Reads engineering metric time-series and emits typed, severity-rated
 * insights (ANOMALY / TREND / RECOMMENDATION / SUMMARY).
 *
 * Routed to Claude Sonnet (task = "analytical_reasoning") because Sonnet leads
 * 2026 benchmarks on structured reasoning and long-context stitching — well
 * suited for surveying multi-metric history and surfacing patterns.
 */

import { INSIGHTS_SYSTEM_PROMPT } from "../prompts";
import { routeChat, routeDecision, type TaskType } from "../router";
import { hasAnyProvider } from "../providers";
import { stripJsonFences } from "../client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";

export type InsightPayload = {
  type: "ANOMALY" | "TREND" | "RECOMMENDATION" | "SUMMARY";
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  body: string;
  relatedMetric?: string;
};

export type HealthAnalystInput = {
  org: string;
  period: string;
  metrics: Record<string, unknown>;
};

const TASK: TaskType = "analytical_reasoning";

const FALLBACK: InsightPayload[] = [
  {
    type: "ANOMALY",
    severity: "WARNING",
    title: "QA pass rate dropped 6 points this sprint",
    body: "QA pass rate fell from 84% to 78% in the latest sprint — a sharp reversal after four flat sprints. The drop coincides with elevated bug reopens, pointing to a regression that escaped review.",
    relatedMetric: "qaPassRate",
  },
  {
    type: "TREND",
    severity: "WARNING",
    title: "Bug reopens climbing for 6 straight weeks",
    body: "Weekly bug reopen rate has risen from 6% to 12% over six weeks. This sustained upward trend indicates fixes are shipping without adequate regression coverage.",
    relatedMetric: "bugReopenRate",
  },
  {
    type: "RECOMMENDATION",
    severity: "WARNING",
    title: "Add regression tests to CheckoutForm before Sprint 19",
    body: "Pair with QA to add three regression tests covering the currency selector and FX edge cases in CheckoutForm this sprint. Gate merges to lib/services/pricing.ts on those tests.",
    relatedMetric: "qaPassRate",
  },
  {
    type: "ANOMALY",
    severity: "CRITICAL",
    title: "2 critical CVEs detected in production dependencies",
    body: "lodash 4.17.19 and axios 0.21.1 have known critical CVEs. Upgrade both within the sprint — they sit in request-path code and are directly reachable.",
    relatedMetric: "libraryHealth",
  },
  {
    type: "SUMMARY",
    severity: "INFO",
    title: "Delivery speed up, quality slipping",
    body: "PR cycle time improved to 2.4 days while QA pass rate dropped 6 points and bug reopens doubled. The team is shipping faster but catching less — prioritize regression coverage next sprint.",
  },
];

export const healthAnalystAgent: Agent<HealthAnalystInput, InsightPayload[]> = {
  name: "HealthAnalystAgent",
  role: "Turns engineering metric time-series into typed, severity-rated insights",
  task: TASK,
  async run(input: HealthAnalystInput, ctx: AgentContext): Promise<InsightPayload[]> {
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
        ? `Analyzing metrics with ${providerLabel(target.provider)} ${target.model}…`
        : "No LLM configured — returning pre-built insights…",
      ctx,
      async () => {
        if (!hasAnyProvider()) return FALLBACK;
        try {
          const resp = await routeChat({
            task: TASK,
            messages: [
              { role: "system", content: INSIGHTS_SYSTEM_PROMPT },
              { role: "user", content: JSON.stringify(input) },
            ],
            maxTokens: 1500,
            temperature: 0.3,
            meta: { agent: this.name, orgId: ctx.orgId ?? input.org },
            onFallback: (failure, next) => {
              ctx.emit({
                type: "agent_progress",
                agent: this.name,
                message: `${providerLabel(failure.target.provider)} ${failure.target.model} failed (${failure.error.message}); retrying with ${providerLabel(next.provider)} ${next.model}…`,
              });
            },
          });
          const parsed = JSON.parse(stripJsonFences(resp.text));
          if (!Array.isArray(parsed)) throw new Error("not array");
          return parsed as InsightPayload[];
        } catch (err) {
          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Analyst call failed (${err instanceof Error ? err.message : "unknown"}); using fallback insights.`,
          });
          return FALLBACK;
        }
      },
    );
  },
};

function providerLabel(id: "openai" | "anthropic" | "google"): string {
  return id === "openai" ? "OpenAI" : id === "anthropic" ? "Claude" : "Gemini";
}
