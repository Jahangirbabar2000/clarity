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
 * Pick the first configured provider from the task's preference chain.
 * Throws if no provider at all is configured.
 */
export function routeDecision(task: TaskType): RouteDecision {
  const chain = ROUTING_TABLE[task];
  const configured = new Set(configuredProviderIds());
  for (let i = 0; i < chain.length; i++) {
    const target = chain[i];
    if (configured.has(target.provider)) {
      return { task, target, isPreferred: i === 0 };
    }
  }
  throw new Error(
    `No LLM provider configured for task "${task}". Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY.`,
  );
}

export interface RouteChatParams {
  task: TaskType;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export async function routeChat(params: RouteChatParams): Promise<ChatResponse & { task: TaskType; isPreferred: boolean }> {
  const decision = routeDecision(params.task);
  const req: ChatRequest = {
    model: decision.target.model,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  };
  const resp = await providers[decision.target.provider].chat(req);
  return { ...resp, task: params.task, isPreferred: decision.isPreferred };
}

export async function routeChatStream(
  params: RouteChatParams,
  onDelta: (delta: string) => void,
): Promise<ChatResponse & { task: TaskType; isPreferred: boolean }> {
  const decision = routeDecision(params.task);
  const req: ChatRequest = {
    model: decision.target.model,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  };
  const resp = await providers[decision.target.provider].chatStream(req, onDelta);
  return { ...resp, task: params.task, isPreferred: decision.isPreferred };
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
