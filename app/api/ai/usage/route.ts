/**
 * GET /api/ai/usage
 *
 * Returns aggregate LLM usage stats (tokens + estimated cost) sourced from
 * the ModelCall ledger that `routeChat` / `routeChatStream` writes to on
 * every provider attempt. Powers the Settings > AI Usage panel.
 *
 * Query params:
 *   ?orgId=xxx    Scope to one org (optional)
 *   ?limit=25     How many recent calls to include in the `recent` array
 */

import { NextRequest } from "next/server";
import { getUsageSummary } from "@/lib/ai/usage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 25, 1), 200) : 25;

  try {
    const summary = await getUsageSummary({ orgId, limit });
    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "usage fetch failed",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
