import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ProviderId } from "./providers/types";

/**
 * Helper: reload `./router` with a specific set of configured providers and
 * spy-able chat/chatStream implementations.
 */
async function loadRouterWithProviders(
  configured: ProviderId[],
  overrides: Partial<Record<ProviderId, { chat?: ReturnType<typeof vi.fn>; chatStream?: ReturnType<typeof vi.fn> }>> = {},
) {
  const chatMocks: Record<ProviderId, ReturnType<typeof vi.fn>> = {
    openai: vi.fn(),
    anthropic: vi.fn(),
    google: vi.fn(),
  };
  const streamMocks: Record<ProviderId, ReturnType<typeof vi.fn>> = {
    openai: vi.fn(),
    anthropic: vi.fn(),
    google: vi.fn(),
  };
  for (const id of Object.keys(overrides) as ProviderId[]) {
    if (overrides[id]?.chat) chatMocks[id] = overrides[id]!.chat!;
    if (overrides[id]?.chatStream) streamMocks[id] = overrides[id]!.chatStream!;
  }

  const recordModelCall = vi.fn().mockResolvedValue(undefined);
  vi.doMock("./usage", () => ({ recordModelCall }));

  vi.doMock("./providers", () => {
    const fakeProviders = {
      openai: {
        id: "openai" as const,
        isConfigured: () => configured.includes("openai"),
        chat: chatMocks.openai,
        chatStream: streamMocks.openai,
      },
      anthropic: {
        id: "anthropic" as const,
        isConfigured: () => configured.includes("anthropic"),
        chat: chatMocks.anthropic,
        chatStream: streamMocks.anthropic,
      },
      google: {
        id: "google" as const,
        isConfigured: () => configured.includes("google"),
        chat: chatMocks.google,
        chatStream: streamMocks.google,
      },
    };
    return {
      providers: fakeProviders,
      configuredProviderIds: () => configured,
      hasAnyProvider: () => configured.length > 0,
      getProvider: (id: ProviderId) => fakeProviders[id],
    };
  });

  vi.resetModules();
  const mod = await import("./router");
  return { ...mod, chatMocks, streamMocks, recordModelCall };
}

afterEach(() => {
  vi.doUnmock("./providers");
  vi.doUnmock("./usage");
  vi.resetModules();
});

describe("routeDecision", () => {
  it("picks the primary target when its provider is configured", async () => {
    const { routeDecision } = await loadRouterWithProviders(["openai", "anthropic", "google"]);
    const d = routeDecision("long_context_summary");
    expect(d.target.provider).toBe("google");
    expect(d.target.model).toBe("gemini-2.5-pro");
    expect(d.isPreferred).toBe(true);
  });

  it("falls back to the next configured provider when primary is missing", async () => {
    const { routeDecision } = await loadRouterWithProviders(["anthropic", "openai"]);
    const d = routeDecision("long_context_summary");
    expect(d.target.provider).toBe("anthropic");
    expect(d.isPreferred).toBe(false);
  });

  it("walks the full chain when only the last fallback is configured", async () => {
    const { routeDecision } = await loadRouterWithProviders(["openai"]);
    const d = routeDecision("long_context_summary");
    expect(d.target.provider).toBe("openai");
    expect(d.isPreferred).toBe(false);
  });

  it("throws when no provider is configured", async () => {
    const { routeDecision } = await loadRouterWithProviders([]);
    expect(() => routeDecision("critique")).toThrow(/No LLM provider configured/);
  });

  it("routes critique to OpenAI when available", async () => {
    const { routeDecision } = await loadRouterWithProviders(["openai", "anthropic", "google"]);
    expect(routeDecision("critique").target.provider).toBe("openai");
  });

  it("routes refinement to Claude Haiku when Anthropic is configured", async () => {
    const { routeDecision } = await loadRouterWithProviders(["openai", "anthropic", "google"]);
    const d = routeDecision("refinement");
    expect(d.target.provider).toBe("anthropic");
    expect(d.target.model).toBe("claude-haiku-4-5");
  });

  it("routes classification to Gemini Flash when Google is configured", async () => {
    const { routeDecision } = await loadRouterWithProviders(["openai", "anthropic", "google"]);
    const d = routeDecision("classification");
    expect(d.target.provider).toBe("google");
    expect(d.target.model).toBe("gemini-2.5-flash");
  });
});

describe("routeChat", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("./providers");
  });

  it("dispatches to the chosen provider and returns task metadata", async () => {
    const chat = vi.fn().mockResolvedValue({
      text: "ok",
      model: "gemini-2.5-pro",
      provider: "google",
    });
    const { routeChat } = await loadRouterWithProviders(["google", "openai", "anthropic"], {
      google: { chat },
    });
    const resp = await routeChat({
      task: "long_context_summary",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    });
    expect(chat).toHaveBeenCalledOnce();
    expect(chat.mock.calls[0][0]).toMatchObject({
      model: "gemini-2.5-pro",
      maxTokens: 100,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(resp.task).toBe("long_context_summary");
    expect(resp.isPreferred).toBe(true);
  });

  it("marks isPreferred=false when using a fallback", async () => {
    const chat = vi.fn().mockResolvedValue({
      text: "",
      model: "claude-sonnet-4-5",
      provider: "anthropic",
    });
    const { routeChat } = await loadRouterWithProviders(["anthropic"], {
      anthropic: { chat },
    });
    const resp = await routeChat({
      task: "long_context_summary",
      messages: [{ role: "user", content: "q" }],
    });
    expect(resp.isPreferred).toBe(false);
  });

  it("runtime fallback: falls through to next configured provider when primary errors", async () => {
    const googleChat = vi.fn().mockRejectedValue(new Error("rate limit"));
    const anthropicChat = vi.fn().mockResolvedValue({
      text: "rescued",
      model: "claude-sonnet-4-5",
      provider: "anthropic",
    });
    const onFallback = vi.fn();
    const { routeChat } = await loadRouterWithProviders(
      ["google", "anthropic", "openai"],
      { google: { chat: googleChat }, anthropic: { chat: anthropicChat } },
    );
    const resp = await routeChat({
      task: "long_context_summary",
      messages: [{ role: "user", content: "q" }],
      onFallback,
    });
    expect(googleChat).toHaveBeenCalledOnce();
    expect(anthropicChat).toHaveBeenCalledOnce();
    expect(resp.text).toBe("rescued");
    expect(resp.usedTarget.provider).toBe("anthropic");
    expect(resp.isPreferred).toBe(false);
    expect(resp.fallbacks).toHaveLength(1);
    expect(resp.fallbacks[0].target.provider).toBe("google");
    expect(resp.fallbacks[0].error.message).toBe("rate limit");
    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback.mock.calls[0][0].target.provider).toBe("google");
    expect(onFallback.mock.calls[0][1].provider).toBe("anthropic");
  });

  it("runtime fallback: throws a summarizing error when every configured provider fails", async () => {
    const googleChat = vi.fn().mockRejectedValue(new Error("google down"));
    const anthropicChat = vi.fn().mockRejectedValue(new Error("anthropic 500"));
    const { routeChat } = await loadRouterWithProviders(["google", "anthropic"], {
      google: { chat: googleChat },
      anthropic: { chat: anthropicChat },
    });
    await expect(
      routeChat({
        task: "long_context_summary",
        messages: [{ role: "user", content: "q" }],
      }),
    ).rejects.toThrow(/All 2 configured providers failed.*anthropic 500/);
    expect(googleChat).toHaveBeenCalledOnce();
    expect(anthropicChat).toHaveBeenCalledOnce();
  });

  it("usage hook: records a successful call with agent + orgId metadata", async () => {
    const chat = vi.fn().mockResolvedValue({
      text: "ok",
      model: "gpt-4o",
      provider: "openai",
      usage: { inputTokens: 100, outputTokens: 40 },
    });
    const { routeChat, recordModelCall } = await loadRouterWithProviders(["openai"], {
      openai: { chat },
    });
    await routeChat({
      task: "critique",
      messages: [{ role: "user", content: "x" }],
      meta: { agent: "CriticAgent", orgId: "org-7" },
    });
    expect(recordModelCall).toHaveBeenCalledOnce();
    expect(recordModelCall.mock.calls[0][0]).toMatchObject({
      orgId: "org-7",
      agent: "CriticAgent",
      task: "critique",
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 40,
      success: true,
      wasFallback: false,
    });
  });

  it("usage hook: records both the failed primary AND the successful fallback, marking wasFallback correctly", async () => {
    const anthroChat = vi.fn().mockRejectedValue(new Error("429"));
    const openaiChat = vi.fn().mockResolvedValue({
      text: "ok",
      model: "gpt-4o",
      provider: "openai",
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const { routeChat, recordModelCall } = await loadRouterWithProviders(
      ["anthropic", "openai", "google"],
      { anthropic: { chat: anthroChat }, openai: { chat: openaiChat } },
    );
    await routeChat({
      task: "creative_longform",
      messages: [{ role: "user", content: "x" }],
      meta: { agent: "TicketWriterAgent", orgId: "org-x" },
    });
    expect(recordModelCall).toHaveBeenCalledTimes(2);
    const firstCall = recordModelCall.mock.calls[0][0];
    const secondCall = recordModelCall.mock.calls[1][0];
    expect(firstCall).toMatchObject({
      provider: "anthropic",
      success: false,
      wasFallback: false,
      errorMessage: "429",
    });
    expect(secondCall).toMatchObject({
      provider: "openai",
      success: true,
      wasFallback: true,
    });
  });

  it("runtime fallback: no onFallback called when only one configured provider exists and it fails", async () => {
    const onFallback = vi.fn();
    const { routeChat } = await loadRouterWithProviders(["openai"], {
      openai: { chat: vi.fn().mockRejectedValue(new Error("boom")) },
    });
    await expect(
      routeChat({
        task: "long_context_summary",
        messages: [{ role: "user", content: "q" }],
        onFallback,
      }),
    ).rejects.toThrow(/All 1 configured provider failed/);
    expect(onFallback).not.toHaveBeenCalled();
  });
});

describe("routeChatStream", () => {
  it("forwards onDelta to the chosen provider", async () => {
    const stream = vi.fn().mockImplementation(async (_req, onDelta: (d: string) => void) => {
      onDelta("he");
      onDelta("llo");
      return { text: "hello", model: "claude-sonnet-4-5", provider: "anthropic" };
    });
    const { routeChatStream } = await loadRouterWithProviders(["anthropic", "openai", "google"], {
      anthropic: { chatStream: stream },
    });
    const deltas: string[] = [];
    const resp = await routeChatStream(
      { task: "creative_longform", messages: [{ role: "user", content: "q" }] },
      (d) => deltas.push(d),
    );
    expect(stream).toHaveBeenCalledOnce();
    expect(deltas).toEqual(["he", "llo"]);
    expect(resp.text).toBe("hello");
    expect(resp.task).toBe("creative_longform");
  });

  it("runtime fallback: streams fall back to the next provider on error", async () => {
    const anthropicStream = vi.fn().mockRejectedValue(new Error("stream crashed"));
    const openaiStream = vi
      .fn()
      .mockImplementation(async (_req, onDelta: (d: string) => void) => {
        onDelta("fallback");
        return { text: "fallback", model: "gpt-4o", provider: "openai" };
      });
    const onFallback = vi.fn();
    const { routeChatStream } = await loadRouterWithProviders(
      ["anthropic", "openai", "google"],
      { anthropic: { chatStream: anthropicStream }, openai: { chatStream: openaiStream } },
    );
    const deltas: string[] = [];
    const resp = await routeChatStream(
      {
        task: "creative_longform",
        messages: [{ role: "user", content: "q" }],
        onFallback,
      },
      (d) => deltas.push(d),
    );
    expect(anthropicStream).toHaveBeenCalledOnce();
    expect(openaiStream).toHaveBeenCalledOnce();
    expect(resp.usedTarget.provider).toBe("openai");
    expect(resp.text).toBe("fallback");
    expect(deltas).toEqual(["fallback"]);
    expect(onFallback).toHaveBeenCalledOnce();
  });
});

describe("routingSnapshot", () => {
  it("returns one entry per task type with chosen target", async () => {
    const { routingSnapshot, ROUTING_TABLE } = await loadRouterWithProviders([
      "openai",
      "anthropic",
      "google",
    ]);
    const snap = routingSnapshot();
    expect(snap).toHaveLength(Object.keys(ROUTING_TABLE).length);
    for (const s of snap) {
      expect(s.chosen).not.toBeNull();
      expect(s.preferredTarget).toBeDefined();
      expect(s.configuredProviders.sort()).toEqual(["anthropic", "google", "openai"]);
    }
  });

  it("sets chosen=null when no provider supports a task", async () => {
    const { routingSnapshot } = await loadRouterWithProviders([]);
    const snap = routingSnapshot();
    for (const s of snap) expect(s.chosen).toBeNull();
  });

  it("reports isPreferred=false when a task falls back", async () => {
    const { routingSnapshot } = await loadRouterWithProviders(["openai"]);
    const snap = routingSnapshot();
    const longCtx = snap.find((s) => s.task === "long_context_summary")!;
    expect(longCtx.chosen?.provider).toBe("openai");
    expect(longCtx.isPreferred).toBe(false);
    const critique = snap.find((s) => s.task === "critique")!;
    expect(critique.chosen?.provider).toBe("openai");
    expect(critique.isPreferred).toBe(true);
  });
});
