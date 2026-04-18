import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentEvent } from "./base";

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

const INPUT = {
  org: "Acme",
  period: "last 8 sprints",
  metrics: {
    qaPassRate: { current: 0.8, previous: 0.85, trend: [0.85, 0.82, 0.8] },
  },
};

async function loadHealthAgent({
  hasAny,
  routeChat,
}: {
  hasAny: boolean;
  routeChat: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("../providers", () => ({ hasAnyProvider: () => hasAny }));
  vi.doMock("../router", () => ({
    routeChat,
    routeDecision: vi.fn().mockReturnValue({
      task: "analytical_reasoning",
      target: { provider: "anthropic", model: "claude-sonnet-4-5", rationale: "test" },
      isPreferred: true,
    }),
  }));
  vi.resetModules();
  return (await import("./health-analyst-agent")).healthAnalystAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
  vi.resetModules();
});

describe("healthAnalystAgent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns fallback insights when no LLM is configured", async () => {
    const routeChat = vi.fn();
    const agent = await loadHealthAgent({ hasAny: false, routeChat });
    const { emit } = collector();
    const result = await agent.run(INPUT, { emit });
    expect(routeChat).not.toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("type");
    expect(result[0]).toHaveProperty("severity");
  });

  it("parses a valid JSON array from the LLM", async () => {
    const insights = [
      { type: "ANOMALY", severity: "WARNING", title: "t", body: "b" },
    ];
    const routeChat = vi.fn().mockResolvedValue({ text: JSON.stringify(insights) });
    const agent = await loadHealthAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(INPUT, { emit });
    expect(result).toEqual(insights);
  });

  it("falls back when the LLM returns a non-array JSON value", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: JSON.stringify({ oops: true }) });
    const agent = await loadHealthAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(INPUT, { emit });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back when JSON parse fails", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "not json" });
    const agent = await loadHealthAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(INPUT, { emit });
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back when the LLM call throws", async () => {
    const routeChat = vi.fn().mockRejectedValue(new Error("upstream"));
    const agent = await loadHealthAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    const result = await agent.run(INPUT, { emit });
    expect(result.length).toBeGreaterThan(0);
    const progress = events.find(
      (e) => e.type === "agent_progress" && /upstream|failed/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });
});
