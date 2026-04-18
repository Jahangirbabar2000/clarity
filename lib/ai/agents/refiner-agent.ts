/**
 * RefinerAgent
 *
 * Role: Field-scoped AI edits. Given a single ticket field + a user request
 * ("make acceptance criteria more specific"), returns ONLY the updated value
 * for that field in the same type/shape as currentValue.
 *
 * Routed to Claude Haiku (task = "refinement") because Haiku is the most
 * reliable budget model for strict JSON-schema adherence — important here,
 * because a refiner that adds extra fields corrupts the editor state.
 */

import { TICKET_REFINE_PROMPT } from "../prompts";
import { routeChat, routeDecision, type TaskType } from "../router";
import { hasAnyProvider } from "../providers";
import { stripJsonFences } from "../client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";

export type RefinableField =
  | "title"
  | "description"
  | "acceptanceCriteria"
  | "edgeCases"
  | "outOfScope"
  | "subtasks";

export interface RefinerInput {
  field: RefinableField;
  currentValue: unknown;
  editRequest: string;
  ticketContext: { title: string; description: string };
}

const TASK: TaskType = "refinement";

export const refinerAgent: Agent<RefinerInput, unknown> = {
  name: "RefinerAgent",
  role: "Applies field-scoped inline edits to a ticket",
  task: TASK,
  async run(input: RefinerInput, ctx: AgentContext): Promise<unknown> {
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
        ? `Refining ${input.field} with ${providerLabel(target.provider)} ${target.model}…`
        : `Refining ${input.field} without AI (mock mode)…`,
      ctx,
      async () => {
        if (!hasAnyProvider()) {
          return mockRefine(input);
        }

        try {
          const resp = await routeChat({
            task: TASK,
            messages: [
              { role: "system", content: TICKET_REFINE_PROMPT },
              { role: "user", content: JSON.stringify(input) },
            ],
            maxTokens: 2000,
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
          const cleaned = stripJsonFences(resp.text);
          try {
            return JSON.parse(cleaned);
          } catch {
            // Title/description are raw strings; everything else should be JSON
            return input.field === "title" || input.field === "description"
              ? cleaned
              : input.currentValue;
          }
        } catch (err) {
          ctx.emit({
            type: "agent_progress",
            agent: this.name,
            message: `Refiner call failed (${err instanceof Error ? err.message : "unknown"}); keeping original value.`,
          });
          return mockRefine(input);
        }
      },
    );
  },
};

function mockRefine({ field, currentValue, editRequest }: RefinerInput): unknown {
  if (typeof currentValue === "string") return `${currentValue}\n\n[Refined: ${editRequest}]`;
  if (Array.isArray(currentValue)) return [...currentValue, `Added based on: ${editRequest}`];
  return currentValue;
}

function providerLabel(id: "openai" | "anthropic" | "google"): string {
  return id === "openai" ? "OpenAI" : id === "anthropic" ? "Claude" : "Gemini";
}
