/**
 * Clarity multi-agent registry.
 *
 * Six named agents with distinct roles, each routed (where applicable) to a
 * best-fit LLM via the Model Router. The pipeline orchestrator in pipeline.ts
 * composes these for the ticket-building flow; individual routes use single
 * agents for narrower operations (refinement, insights).
 */

export { contextAgent } from "./context-agent";
export { ticketWriterAgent } from "./ticket-writer-agent";
export { criticAgent } from "./critic-agent";
export { refinerAgent } from "./refiner-agent";
export { sprintPlannerAgent } from "./sprint-planner-agent";
export { healthAnalystAgent } from "./health-analyst-agent";

export type { AgentEvent, AgentContext, Agent, AgentMeta } from "./base";
export type { ContextAgentOutput } from "./context-agent";
export type { CritiqueReport, CritiqueNote, CritiqueSeverity } from "./critic-agent";
export type { RefinerInput, RefinableField } from "./refiner-agent";
export type { HealthAnalystInput, InsightPayload } from "./health-analyst-agent";
export type { SprintPlannerInput } from "./sprint-planner-agent";
export type { TicketWriterInput } from "./ticket-writer-agent";

import { contextAgent } from "./context-agent";
import { ticketWriterAgent } from "./ticket-writer-agent";
import { criticAgent } from "./critic-agent";
import { refinerAgent } from "./refiner-agent";
import { sprintPlannerAgent } from "./sprint-planner-agent";
import { healthAnalystAgent } from "./health-analyst-agent";
import type { AgentMeta } from "./base";

/** All agents, in a stable order, for Settings UI + docs. */
export const AGENT_REGISTRY: AgentMeta[] = [
  {
    name: contextAgent.name,
    role: contextAgent.role,
    task: contextAgent.task,
  },
  {
    name: ticketWriterAgent.name,
    role: ticketWriterAgent.role,
    task: ticketWriterAgent.task,
  },
  {
    name: criticAgent.name,
    role: criticAgent.role,
    task: criticAgent.task,
  },
  {
    name: refinerAgent.name,
    role: refinerAgent.role,
    task: refinerAgent.task,
  },
  {
    name: sprintPlannerAgent.name,
    role: sprintPlannerAgent.role,
    task: sprintPlannerAgent.task,
  },
  {
    name: healthAnalystAgent.name,
    role: healthAnalystAgent.role,
    task: healthAnalystAgent.task,
  },
];
