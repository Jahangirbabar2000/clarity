import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@/lib/ai/providers");
  vi.doUnmock("@/lib/ai/router");
  vi.doUnmock("@/lib/ai/agents");
  vi.resetModules();
});

describe("GET /api/ai/routing", () => {
  it("returns configured providers, snapshot, routing table, and agent registry", async () => {
    vi.doMock("@/lib/ai/providers", () => ({
      configuredProviderIds: () => ["openai", "anthropic"],
    }));
    vi.doMock("@/lib/ai/router", () => ({
      routingSnapshot: () => [
        {
          task: "critique",
          chosen: { provider: "openai", model: "gpt-4o", rationale: "r" },
          isPreferred: true,
          preferredTarget: { provider: "openai", model: "gpt-4o", rationale: "r" },
          configuredProviders: ["openai", "anthropic"],
        },
      ],
      ROUTING_TABLE: {
        critique: [{ provider: "openai", model: "gpt-4o", rationale: "r" }],
      },
    }));
    vi.doMock("@/lib/ai/agents", () => ({
      AGENT_REGISTRY: [
        { name: "ContextAgent", role: "rag", task: "long_context_summary" },
        { name: "CriticAgent", role: "review", task: "critique" },
      ],
    }));

    vi.resetModules();
    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.configuredProviders).toEqual(["openai", "anthropic"]);
    expect(body.snapshot).toHaveLength(1);
    expect(body.snapshot[0].task).toBe("critique");
    expect(body.routingTable.critique[0].provider).toBe("openai");
    expect(body.agents).toHaveLength(2);
    expect(body.agents[1].name).toBe("CriticAgent");
  });

  it("still responds when no providers are configured", async () => {
    vi.doMock("@/lib/ai/providers", () => ({
      configuredProviderIds: () => [],
    }));
    vi.doMock("@/lib/ai/router", () => ({
      routingSnapshot: () => [],
      ROUTING_TABLE: {},
    }));
    vi.doMock("@/lib/ai/agents", () => ({ AGENT_REGISTRY: [] }));

    vi.resetModules();
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configuredProviders).toEqual([]);
  });
});
