/**
 * Multi-LLM Router for Clarity.
 *
 * Routes each agent task to the best-fit (provider, model) pair based on published
 * 2026 benchmarks (SWE-bench, MATH, WebDev Arena, StackCompare cost/perf studies):
 *
 *   - long_context_summary  → Google Gemini 2.5 Pro     (2M context, best doc digest)
 *   - creative_longform     → Anthropic Claude Sonnet 4 (top creative+structured writing)
 *   - analytical_reasoning  → Anthropic Claude Sonnet 4 (structured reasoning leader)
 *   - critique              → OpenAI GPT-4o             (step-by-step causal analysis)
 *   - refinement            → Anthropic Claude Haiku    (strict schema adherence)
 *   - classification        → Google Gemini 2.0 Flash   (cheapest, fastest at scale)
 *
 * Falls back automatically: if a task's preferred provider is not configured,
 * the router walks the fallback chain until it finds a configured provider,
 * so the app still works with just OPENAI_API_KEY (single-vendor degraded mode).
 */

import { providers, configuredProviderIds } from "./providers";
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ProviderId,
} from "./providers/types";
import { recordModelCall } from "./usage";

export type TaskType =
  | "long_context_summary"
  | "creative_longform"
  | "analytical_reasoning"
  | "critique"
  | "refinement"
  | "classification";

export interface RouteTarget {
  provider: ProviderId;
  model: string;
  rationale: string;
}

/**
 * Primary → fallback chain per task. First configured provider wins.
 *
 * Fallback models are chosen to preserve the *task shape* (e.g. cheap/fast tier
 * falls back to cheap/fast tier), not just random substitution.
 */
export const ROUTING_TABLE: Record<TaskType, RouteTarget[]> = {
  long_context_summary: [
    {
      provider: "google",
      model: "gemini-2.5-pro",
      rationale: "2M-token context window; best at long-doc summarization",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      rationale: "200K context; strong context-stitching fallback",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      rationale: "128K context; general-purpose fallback",
    },
  ],
  creative_longform: [
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      rationale: "Top benchmark on creative + structured long-form writing",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      rationale: "Close second on creative writing; great structured output",
    },
    {
      provider: "google",
      model: "gemini-2.5-pro",
      rationale: "Budget creative fallback",
    },
  ],
  analytical_reasoning: [
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      rationale: "Leads on architectural + structured reasoning benchmarks",
    },
    {
      provider: "openai",
      model: "gpt-4o",
      rationale: "Strong multi-step reasoning; reliable fallback",
    },
    {
      provider: "google",
      model: "gemini-2.5-pro",
      rationale: "Fallback for analytical tasks",
    },
  ],
  critique: [
    {
      provider: "openai",
      model: "gpt-4o",
      rationale: "Best causal-chain analysis + actionable-fix style",
    },
    {
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      rationale: "Also strong critique; tied on complex reasoning",
    },
    {
      provider: "google",
      model: "gemini-2.5-pro",
      rationale: "Critique fallback",
    },
  ],
  refinement: [
    {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      rationale: "Top JSON-schema adherence for single-field edits",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      rationale: "Cheap, reliable middle-ground for refinements",
    },
    {
      provider: "google",
      model: "gemini-2.5-flash",
      rationale: "Cheapest refinement fallback",
    },
  ],
  classification: [
    {
      provider: "google",
      model: "gemini-2.5-flash",
      rationale: "Cheapest/fastest tier; classification ties flagships here",
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      rationale: "Second cheapest; mature SDK",
    },
    {
      provider: "anthropic",
      model: "claude-haiku-4-5",
      rationale: "Most expensive cheap-tier but most precise on schemas",
    },
  ],
};

export interface RouteDecision {
  task: TaskType;
  target: RouteTarget;
  isPreferred: boolean;
}

/**
 * Ordered list of (target, isPreferred) for every *configured* provider in
 * the task's preference chain. The first entry is what we'll try first;
 * the rest are runtime fallbacks used by {@link routeChat} / {@link routeChatStream}
 * if the primary provider errors (rate limit, transient 5xx, bad API key, etc.).
 */
export function candidateTargets(task: TaskType): RouteDecision[] {
  const chain = ROUTING_TABLE[task];
  const configured = new Set(configuredProviderIds());
  const decisions: RouteDecision[] = [];
  for (let i = 0; i < chain.length; i++) {
    const target = chain[i];
    if (configured.has(target.provider)) {
      decisions.push({ task, target, isPreferred: i === 0 });
    }
  }
  return decisions;
}

/**
 * Pick the first configured provider from the task's preference chain.
 * Throws if no provider at all is configured.
 */
export function routeDecision(task: TaskType): RouteDecision {
  const candidates = candidateTargets(task);
  if (candidates.length === 0) {
    throw new Error(
      `No LLM provider configured for task "${task}". Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY.`,
    );
  }
  return candidates[0];
}

export interface RouteChatParams {
  task: TaskType;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * Called if a provider attempt fails and the router falls over to the
   * next candidate. Lets the caller (usually an agent) emit a progress
   * event so the UI can show the fallback.
   */
  onFallback?: (failure: RouteFailure, next: RouteTarget) => void;
  /**
   * Usage-tracking metadata. When present, every provider attempt is logged
   * to the ModelCall ledger so Settings > AI Usage can render tokens/cost
   * breakdowns. Agents pass `agent: this.name`; orgId is threaded through
   * from the API layer where available.
   */
  meta?: {
    agent?: string;
    orgId?: string;
  };
}

export interface RouteFailure {
  target: RouteTarget;
  error: Error;
}

export interface RouteChatResult extends ChatResponse {
  task: TaskType;
  isPreferred: boolean;
  /** The target actually used (may differ from preferred after runtime fallback). */
  usedTarget: RouteTarget;
  /** Targets that were tried and failed, in order. Empty if the primary worked. */
  fallbacks: RouteFailure[];
}

async function runWithFallback(
  params: RouteChatParams,
  exec: (target: RouteTarget, req: ChatRequest) => Promise<ChatResponse>,
): Promise<RouteChatResult> {
  const candidates = candidateTargets(params.task);
  if (candidates.length === 0) {
    throw new Error(
      `No LLM provider configured for task "${params.task}". Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY.`,
    );
  }

  const fallbacks: RouteFailure[] = [];
  let lastError: Error | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const decision = candidates[i];
    const req: ChatRequest = {
      model: decision.target.model,
      messages: params.messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    };
    const wasFallback = i > 0;
    const attemptStartedAt = Date.now();
    try {
      const resp = await exec(decision.target, req);
      // Fire-and-forget ledger write. We don't await — tracking should never
      // be on the critical path of a user request.
      void recordModelCall({
        orgId: params.meta?.orgId,
        agent: params.meta?.agent,
        task: params.task,
        provider: decision.target.provider,
        model: decision.target.model,
        inputTokens: resp.usage?.inputTokens,
        outputTokens: resp.usage?.outputTokens,
        durationMs: Date.now() - attemptStartedAt,
        success: true,
        wasFallback,
      });
      return {
        ...resp,
        task: params.task,
        isPreferred: decision.isPreferred && fallbacks.length === 0,
        usedTarget: decision.target,
        fallbacks,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;
      fallbacks.push({ target: decision.target, error });
      void recordModelCall({
        orgId: params.meta?.orgId,
        agent: params.meta?.agent,
        task: params.task,
        provider: decision.target.provider,
        model: decision.target.model,
        durationMs: Date.now() - attemptStartedAt,
        success: false,
        wasFallback,
        errorMessage: error.message,
      });
      const next = candidates[i + 1];
      if (next && params.onFallback) {
        params.onFallback({ target: decision.target, error }, next.target);
      }
    }
  }

  throw new Error(
    `All ${candidates.length} configured provider${candidates.length === 1 ? "" : "s"} failed for task "${params.task}". ` +
      `Last error: ${lastError?.message ?? "unknown"}`,
  );
}

export async function routeChat(params: RouteChatParams): Promise<RouteChatResult> {
  return runWithFallback(params, (target, req) =>
    providers[target.provider].chat(req),
  );
}

export async function routeChatStream(
  params: RouteChatParams,
  onDelta: (delta: string) => void,
): Promise<RouteChatResult> {
  return runWithFallback(params, (target, req) =>
    providers[target.provider].chatStream(req, onDelta),
  );
}

/** Human-readable snapshot of the current routing state, for UI/Settings display. */
export interface RoutingSnapshot {
  task: TaskType;
  chosen: RouteTarget | null;
  isPreferred: boolean;
  preferredTarget: RouteTarget;
  configuredProviders: ProviderId[];
}

export function routingSnapshot(): RoutingSnapshot[] {
  const configured = new Set(configuredProviderIds());
  return (Object.keys(ROUTING_TABLE) as TaskType[]).map((task) => {
    const chain = ROUTING_TABLE[task];
    const preferredTarget = chain[0];
    let chosen: RouteTarget | null = null;
    let isPreferred = false;
    for (let i = 0; i < chain.length; i++) {
      if (configured.has(chain[i].provider)) {
        chosen = chain[i];
        isPreferred = i === 0;
        break;
      }
    }
    return {
      task,
      chosen,
      isPreferred,
      preferredTarget,
      configuredProviders: Array.from(configured),
    };
  });
}
