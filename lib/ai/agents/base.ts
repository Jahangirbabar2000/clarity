/**
 * Base types for Clarity's multi-agent system.
 *
 * Every agent:
 *   - has a stable `name` and human-readable `role`
 *   - declares the `TaskType` it routes to (or `null` if it's deterministic / non-LLM)
 *   - emits lifecycle events through an {@link AgentContext} so the pipeline can
 *     stream per-agent telemetry to the UI (start → progress/stream → done).
 *
 * The agents themselves don't know about SSE or HTTP; the pipeline is responsible
 * for turning {@link AgentEvent}s into whatever transport the caller needs.
 */

import type { TaskType, RouteTarget } from "../router";
import type { ProviderId } from "../providers/types";

export type AgentEvent =
  | {
      type: "agent_start";
      agent: string;
      role: string;
      task: TaskType | null;
      target: { provider: ProviderId; model: string } | null;
      message: string;
      startedAt: number;
    }
  | {
      type: "agent_progress";
      agent: string;
      message: string;
    }
  | {
      type: "agent_stream";
      agent: string;
      text: string;
    }
  | {
      type: "agent_done";
      agent: string;
      durationMs: number;
      summary?: string;
    }
  | {
      type: "agent_error";
      agent: string;
      message: string;
    };

export interface AgentContext {
  emit: (event: AgentEvent) => void;
}

export interface AgentMeta {
  name: string;
  role: string;
  /** The TaskType this agent routes to, or null for deterministic (non-LLM) agents. */
  task: TaskType | null;
}

export interface Agent<Input, Output> extends AgentMeta {
  run(input: Input, ctx: AgentContext): Promise<Output>;
}

/**
 * Helper so agent implementations don't have to hand-roll start/done events.
 * Wraps the agent body; emits agent_start before, agent_done after, and
 * agent_error if the body throws (rethrowing so the pipeline can decide).
 */
export async function runAgent<Input, Output>(
  meta: AgentMeta,
  target: { provider: ProviderId; model: string } | null,
  message: string,
  ctx: AgentContext,
  body: () => Promise<Output>,
): Promise<Output> {
  const startedAt = Date.now();
  ctx.emit({
    type: "agent_start",
    agent: meta.name,
    role: meta.role,
    task: meta.task,
    target,
    message,
    startedAt,
  });
  try {
    const result = await body();
    ctx.emit({
      type: "agent_done",
      agent: meta.name,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    ctx.emit({
      type: "agent_error",
      agent: meta.name,
      message: errMessage,
    });
    throw err;
  }
}
