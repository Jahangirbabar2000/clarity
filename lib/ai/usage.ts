/**
 * Token & cost tracking for every LLM call the router makes.
 *
 * Every successful or failed provider invocation is appended to the
 * ModelCall ledger. The Settings > AI Usage panel reads from this ledger
 * to surface tokens used, estimated USD cost, and per-agent / per-provider
 * breakdowns — turning the multi-LLM pipeline into a measurable
 * business-value story instead of an opaque black box.
 *
 * Cost estimation uses a lookup table of published 2026 per-1K-token
 * prices. The price list is tiny and easy to update; if a model is
 * unknown we fall back to null (UI renders "—" instead of a wrong number).
 */

import type { ProviderId } from "./providers/types";
import { prisma } from "@/lib/db/client";

/**
 * Published per-1K-token prices as of 2026. Input vs output separately.
 * Keys are the exact `model` strings we pass to provider SDKs.
 *
 * Keep this small: only the models actually referenced in ROUTING_TABLE.
 * If a call uses an unknown model, `estimateCostUsd` returns null.
 */
export const PRICING_PER_1K_TOKENS: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 0.0025, out: 0.01 },
  "gpt-4o-mini": { in: 0.00015, out: 0.0006 },
  "claude-sonnet-4-5": { in: 0.003, out: 0.015 },
  "claude-haiku-4-5": { in: 0.0008, out: 0.004 },
  "gemini-2.5-pro": { in: 0.00125, out: 0.005 },
  "gemini-2.5-flash": { in: 0.000075, out: 0.0003 },
  "gemini-2.0-flash": { in: 0.0001, out: 0.0004 },
};

/**
 * Estimate USD cost for a call. Returns null when either the model is
 * unknown or no token counts were reported by the provider.
 */
export function estimateCostUsd(
  model: string,
  usage: { inputTokens?: number; outputTokens?: number } | undefined,
): number | null {
  if (!usage) return null;
  const pricing = PRICING_PER_1K_TOKENS[model];
  if (!pricing) return null;
  const inTokens = usage.inputTokens ?? 0;
  const outTokens = usage.outputTokens ?? 0;
  if (inTokens === 0 && outTokens === 0) return null;
  return (inTokens / 1000) * pricing.in + (outTokens / 1000) * pricing.out;
}

export interface RecordModelCallInput {
  orgId?: string;
  task: string;
  agent?: string;
  provider: ProviderId;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
  success: boolean;
  wasFallback?: boolean;
  errorMessage?: string;
}

/**
 * Fire-and-forget ledger write. Errors are swallowed (logged) so a tracking
 * failure never takes down a user request. Always returns — callers can
 * optionally await if they want to guarantee persistence before responding.
 */
export async function recordModelCall(input: RecordModelCallInput): Promise<void> {
  try {
    const cost = estimateCostUsd(input.model, {
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });
    await prisma.modelCall.create({
      data: {
        orgId: input.orgId ?? null,
        task: input.task,
        agent: input.agent ?? null,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        estimatedCostUsd: cost,
        durationMs: input.durationMs,
        success: input.success,
        wasFallback: input.wasFallback ?? false,
        errorMessage: input.errorMessage ?? null,
      },
    });
  } catch (err) {
    // Ledger writes must never break live requests. Log only.
    // eslint-disable-next-line no-console
    console.warn("[usage] recordModelCall failed", err instanceof Error ? err.message : err);
  }
}

export interface UsageSummary {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  fallbackCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byProvider: Array<{
    provider: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  byAgent: Array<{
    agent: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  byTask: Array<{
    task: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    calls: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  recent: Array<{
    id: string;
    createdAt: string;
    task: string;
    agent: string | null;
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    estimatedCostUsd: number | null;
    durationMs: number;
    success: boolean;
    wasFallback: boolean;
  }>;
}

/**
 * Aggregate the ledger into breakdowns the Settings UI renders.
 * Caller can optionally scope to a single org.
 */
export async function getUsageSummary(opts: { orgId?: string; limit?: number } = {}): Promise<UsageSummary> {
  const limit = opts.limit ?? 25;
  const where = opts.orgId ? { orgId: opts.orgId } : {};

  const calls = await prisma.modelCall.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const bucket = <K extends string>(rows: typeof calls, keyFn: (r: (typeof calls)[number]) => K) => {
    const acc = new Map<
      K,
      { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
    >();
    for (const r of rows) {
      const key = keyFn(r);
      const prev = acc.get(key) ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      prev.calls += 1;
      prev.inputTokens += r.inputTokens ?? 0;
      prev.outputTokens += r.outputTokens ?? 0;
      prev.costUsd += r.estimatedCostUsd ?? 0;
      acc.set(key, prev);
    }
    return acc;
  };

  const byProviderMap = bucket(calls, (r) => r.provider);
  const byAgentMap = bucket(calls, (r) => r.agent ?? "(unknown)");
  const byTaskMap = bucket(calls, (r) => r.task);
  const byModelMap = bucket(calls, (r) => `${r.provider}|${r.model}`);

  const totalCalls = calls.length;
  const successfulCalls = calls.filter((c) => c.success).length;
  const failedCalls = totalCalls - successfulCalls;
  const fallbackCalls = calls.filter((c) => c.wasFallback).length;
  const totalInputTokens = calls.reduce((a, c) => a + (c.inputTokens ?? 0), 0);
  const totalOutputTokens = calls.reduce((a, c) => a + (c.outputTokens ?? 0), 0);
  const totalCostUsd = calls.reduce((a, c) => a + (c.estimatedCostUsd ?? 0), 0);

  return {
    totalCalls,
    successfulCalls,
    failedCalls,
    fallbackCalls,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    byProvider: Array.from(byProviderMap.entries()).map(([provider, v]) => ({ provider, ...v })),
    byAgent: Array.from(byAgentMap.entries()).map(([agent, v]) => ({ agent, ...v })),
    byTask: Array.from(byTaskMap.entries()).map(([task, v]) => ({ task, ...v })),
    byModel: Array.from(byModelMap.entries()).map(([key, v]) => {
      const [provider, model] = key.split("|");
      return { provider, model, ...v };
    }),
    recent: calls.slice(0, limit).map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      task: r.task,
      agent: r.agent,
      provider: r.provider,
      model: r.model,
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      estimatedCostUsd: r.estimatedCostUsd,
      durationMs: r.durationMs,
      success: r.success,
      wasFallback: r.wasFallback,
    })),
  };
}
