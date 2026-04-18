import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

afterEach(() => {
  vi.doUnmock("@/lib/ai/usage");
  vi.resetModules();
});

async function loadRouteWithMockedUsage(summary: Record<string, unknown>) {
  const getUsageSummary = vi.fn().mockResolvedValue(summary);
  vi.doMock("@/lib/ai/usage", () => ({ getUsageSummary }));
  vi.resetModules();
  const route = await import("./route");
  return { route, getUsageSummary };
}

describe("GET /api/ai/usage", () => {
  it("returns the aggregated summary", async () => {
    const summary = {
      totalCalls: 7,
      successfulCalls: 6,
      failedCalls: 1,
      fallbackCalls: 1,
      totalInputTokens: 1234,
      totalOutputTokens: 567,
      totalCostUsd: 0.25,
      byProvider: [],
      byAgent: [],
      byTask: [],
      byModel: [],
      recent: [],
    };
    const { route, getUsageSummary } = await loadRouteWithMockedUsage(summary);
    const res = await route.GET(new NextRequest("http://localhost/api/ai/usage"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCalls).toBe(7);
    expect(getUsageSummary).toHaveBeenCalledWith({ orgId: undefined, limit: 25 });
  });

  it("threads orgId and limit query params", async () => {
    const { route, getUsageSummary } = await loadRouteWithMockedUsage({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      byProvider: [],
      byAgent: [],
      byTask: [],
      byModel: [],
      recent: [],
    });
    await route.GET(
      new NextRequest("http://localhost/api/ai/usage?orgId=org-1&limit=50"),
    );
    expect(getUsageSummary).toHaveBeenCalledWith({ orgId: "org-1", limit: 50 });
  });

  it("clamps the limit to a safe range", async () => {
    const { route, getUsageSummary } = await loadRouteWithMockedUsage({
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      fallbackCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostUsd: 0,
      byProvider: [],
      byAgent: [],
      byTask: [],
      byModel: [],
      recent: [],
    });
    await route.GET(new NextRequest("http://localhost/api/ai/usage?limit=99999"));
    expect(getUsageSummary.mock.calls[0][0].limit).toBeLessThanOrEqual(200);
  });

  it("returns 500 with a readable error if the aggregator throws", async () => {
    vi.doMock("@/lib/ai/usage", () => ({
      getUsageSummary: vi.fn().mockRejectedValue(new Error("db down")),
    }));
    vi.resetModules();
    const route = await import("./route");
    const res = await route.GET(new NextRequest("http://localhost/api/ai/usage"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/db down/);
  });
});
