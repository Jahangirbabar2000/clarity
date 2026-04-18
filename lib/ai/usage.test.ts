import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("@/lib/db/client");
  vi.resetModules();
});

describe("estimateCostUsd", () => {
  it("computes cost from input + output tokens for a known model", async () => {
    const { estimateCostUsd } = await import("./usage");
    const cost = estimateCostUsd("gpt-4o", { inputTokens: 1000, outputTokens: 500 });
    // 1000/1000 * 0.0025 + 500/1000 * 0.01 = 0.0025 + 0.005 = 0.0075
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it("returns null for unknown models", async () => {
    const { estimateCostUsd } = await import("./usage");
    expect(
      estimateCostUsd("made-up-model", { inputTokens: 1000, outputTokens: 500 }),
    ).toBeNull();
  });

  it("returns null when no token usage is reported", async () => {
    const { estimateCostUsd } = await import("./usage");
    expect(estimateCostUsd("gpt-4o", undefined)).toBeNull();
    expect(estimateCostUsd("gpt-4o", {})).toBeNull();
    expect(estimateCostUsd("gpt-4o", { inputTokens: 0, outputTokens: 0 })).toBeNull();
  });

  it("haiku is cheaper than sonnet for the same token count", async () => {
    const { estimateCostUsd } = await import("./usage");
    const haiku = estimateCostUsd("claude-haiku-4-5", { inputTokens: 1000, outputTokens: 1000 })!;
    const sonnet = estimateCostUsd("claude-sonnet-4-5", { inputTokens: 1000, outputTokens: 1000 })!;
    expect(haiku).toBeLessThan(sonnet);
  });

  it("gemini-2.5-flash is the cheapest tier", async () => {
    const { estimateCostUsd, PRICING_PER_1K_TOKENS } = await import("./usage");
    const flashIn = PRICING_PER_1K_TOKENS["gemini-2.5-flash"].in;
    const allIns = Object.values(PRICING_PER_1K_TOKENS).map((p) => p.in);
    expect(flashIn).toBe(Math.min(...allIns));
    // Sanity: also produces a non-null cost
    expect(estimateCostUsd("gemini-2.5-flash", { inputTokens: 1000, outputTokens: 1000 })).not.toBeNull();
  });
});

async function loadUsageWithMockedPrisma(modelCallMocks: {
  create?: ReturnType<typeof vi.fn>;
  findMany?: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("@/lib/db/client", () => ({
    prisma: {
      modelCall: {
        create: modelCallMocks.create ?? vi.fn(),
        findMany: modelCallMocks.findMany ?? vi.fn().mockResolvedValue([]),
      },
    },
  }));
  vi.resetModules();
  return await import("./usage");
}

describe("recordModelCall", () => {
  it("persists a successful call with computed cost", async () => {
    const create = vi.fn().mockResolvedValue({});
    const { recordModelCall } = await loadUsageWithMockedPrisma({ create });
    await recordModelCall({
      task: "creative_longform",
      agent: "TicketWriterAgent",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      inputTokens: 2000,
      outputTokens: 500,
      durationMs: 1234,
      success: true,
    });
    expect(create).toHaveBeenCalledOnce();
    const row = create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      task: "creative_longform",
      agent: "TicketWriterAgent",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      inputTokens: 2000,
      outputTokens: 500,
      durationMs: 1234,
      success: true,
      wasFallback: false,
      errorMessage: null,
      orgId: null,
    });
    // 2000/1000 * 0.003 + 500/1000 * 0.015 = 0.006 + 0.0075 = 0.0135
    expect(row.estimatedCostUsd).toBeCloseTo(0.0135, 6);
  });

  it("persists a failed call with errorMessage and wasFallback", async () => {
    const create = vi.fn().mockResolvedValue({});
    const { recordModelCall } = await loadUsageWithMockedPrisma({ create });
    await recordModelCall({
      task: "critique",
      provider: "openai",
      model: "gpt-4o",
      durationMs: 200,
      success: false,
      wasFallback: true,
      errorMessage: "rate limit",
    });
    const row = create.mock.calls[0][0].data;
    expect(row.success).toBe(false);
    expect(row.wasFallback).toBe(true);
    expect(row.errorMessage).toBe("rate limit");
    expect(row.estimatedCostUsd).toBeNull();
  });

  it("swallows Prisma errors so tracking never breaks the request path", async () => {
    const create = vi.fn().mockRejectedValue(new Error("db down"));
    const { recordModelCall } = await loadUsageWithMockedPrisma({ create });
    // Must not throw
    await expect(
      recordModelCall({
        task: "critique",
        provider: "openai",
        model: "gpt-4o",
        durationMs: 100,
        success: true,
      }),
    ).resolves.toBeUndefined();
  });
});

describe("getUsageSummary", () => {
  it("aggregates by provider, agent, task, and model", async () => {
    const rows = [
      {
        id: "1",
        createdAt: new Date("2026-04-01T00:00:00Z"),
        task: "creative_longform",
        agent: "TicketWriterAgent",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCostUsd: 0.0105,
        durationMs: 200,
        success: true,
        wasFallback: false,
      },
      {
        id: "2",
        createdAt: new Date("2026-04-01T00:01:00Z"),
        task: "critique",
        agent: "CriticAgent",
        provider: "openai",
        model: "gpt-4o",
        inputTokens: 500,
        outputTokens: 200,
        estimatedCostUsd: 0.00325,
        durationMs: 100,
        success: true,
        wasFallback: false,
      },
      {
        id: "3",
        createdAt: new Date("2026-04-01T00:02:00Z"),
        task: "creative_longform",
        agent: "TicketWriterAgent",
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        inputTokens: 100,
        outputTokens: null,
        estimatedCostUsd: null,
        durationMs: 50,
        success: false,
        wasFallback: false,
        errorMessage: "boom",
      },
    ];
    const findMany = vi.fn().mockResolvedValue(rows);
    const { getUsageSummary } = await loadUsageWithMockedPrisma({ findMany });
    const summary = await getUsageSummary();
    expect(summary.totalCalls).toBe(3);
    expect(summary.successfulCalls).toBe(2);
    expect(summary.failedCalls).toBe(1);
    expect(summary.totalInputTokens).toBe(1600);
    expect(summary.totalOutputTokens).toBe(700);
    expect(summary.totalCostUsd).toBeCloseTo(0.0105 + 0.00325, 6);

    const anthropic = summary.byProvider.find((p) => p.provider === "anthropic")!;
    expect(anthropic.calls).toBe(2);
    expect(anthropic.inputTokens).toBe(1100);

    const writer = summary.byAgent.find((a) => a.agent === "TicketWriterAgent")!;
    expect(writer.calls).toBe(2);

    const critiqueTask = summary.byTask.find((t) => t.task === "critique")!;
    expect(critiqueTask.calls).toBe(1);

    expect(summary.byModel.find((m) => m.model === "gpt-4o")?.calls).toBe(1);
    expect(summary.recent[0].id).toBe("1");
  });

  it("scopes by orgId when provided", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { getUsageSummary } = await loadUsageWithMockedPrisma({ findMany });
    await getUsageSummary({ orgId: "org-42" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: "org-42" } }),
    );
  });
});
