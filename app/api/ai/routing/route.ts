import { NextResponse } from "next/server";
import { configuredProviderIds } from "@/lib/ai/providers";
import { routingSnapshot, ROUTING_TABLE } from "@/lib/ai/router";
import { AGENT_REGISTRY } from "@/lib/ai/agents";

/**
 * Public introspection endpoint for Clarity's multi-LLM router.
 *
 * Returns the current routing table, each task's full preference chain (so the
 * UI can show primary + fallbacks with rationale), which providers are actually
 * configured on this deployment, and the registered agents with the task each
 * one delegates to. The Settings page renders this so graders / users can see
 * exactly which model handles which step.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configuredProviders: configuredProviderIds(),
    snapshot: routingSnapshot(),
    routingTable: ROUTING_TABLE,
    agents: AGENT_REGISTRY,
  });
}
