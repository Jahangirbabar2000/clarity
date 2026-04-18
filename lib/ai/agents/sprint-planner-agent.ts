/**
 * SprintPlannerAgent (deterministic, non-LLM)
 *
 * Role: Pack subtasks into sprints respecting dependsOn constraints and a
 * velocity cap, using a greedy topological sort.
 *
 * This agent is intentionally NOT backed by an LLM. Dependency ordering under
 * velocity caps is a graph problem with a correct solution; an LLM here would
 * add non-determinism and hallucination risk with zero upside. It's included
 * in the agent registry so the multi-agent architecture covers both LLM and
 * non-LLM roles — reflecting how real agent systems mix deterministic tools
 * with reasoning models.
 */

import { planSprints, type PlannedSprint } from "../sprint-planner";
import type { Subtask } from "@prisma/client";
import type { Agent, AgentContext } from "./base";
import { runAgent } from "./base";

export interface SprintPlannerInput {
  subtasks: Subtask[];
  velocityPerSprint: number;
  sprintLengthWeeks: number;
}

export const sprintPlannerAgent: Agent<SprintPlannerInput, PlannedSprint[]> = {
  name: "SprintPlannerAgent",
  role: "Packs subtasks into sprints via greedy topological sort (deterministic, no LLM)",
  task: null,
  async run(input: SprintPlannerInput, ctx: AgentContext): Promise<PlannedSprint[]> {
    return runAgent(
      this,
      null,
      `Packing ${input.subtasks.length} subtasks into sprints at ${input.velocityPerSprint} pts/sprint (deterministic)…`,
      ctx,
      async () => {
        const sprints = planSprints(
          input.subtasks,
          input.velocityPerSprint,
          input.sprintLengthWeeks,
        );
        ctx.emit({
          type: "agent_progress",
          agent: this.name,
          message: `Produced ${sprints.length} sprints totaling ${sprints.reduce(
            (n, s) => n + s.committedPoints,
            0,
          )} points.`,
        });
        return sprints;
      },
    );
  },
};
