import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentEvent } from "./base";
import type { BuildTicketPayload } from "@/types/api";

const DRAFT: BuildTicketPayload = {
  ticket: {
    title: "Do a thing",
    description: "Some description.",
    acceptanceCriteria: ["AC1"],
    edgeCases: ["EC1"],
    outOfScope: ["OOS1"],
    type: "FEATURE",
    priority: "MED",
    storyPoints: 3,
    suggestedLabels: ["x"],
  },
  subtasks: [],
};

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

async function loadCriticAgent({
  hasAny,
  routeChat,
  target = { provider: "anthropic", model: "claude-sonnet-4-5", rationale: "test" },
  openaiConfigured = false,
  openaiToolRunner,
}: {
  hasAny: boolean;
  routeChat: ReturnType<typeof vi.fn>;
  target?: { provider: "openai" | "anthropic" | "google"; model: string; rationale: string };
  openaiConfigured?: boolean;
  openaiToolRunner?: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("../providers", () => ({
    hasAnyProvider: () => hasAny,
    providers: {
      openai: { id: "openai", isConfigured: () => openaiConfigured, chat: vi.fn(), chatStream: vi.fn() },
      anthropic: { id: "anthropic", isConfigured: () => true, chat: vi.fn(), chatStream: vi.fn() },
      google: { id: "google", isConfigured: () => true, chat: vi.fn(), chatStream: vi.fn() },
    },
  }));
  vi.doMock("../router", () => ({
    routeChat,
    routeDecision: vi.fn().mockReturnValue({ task: "critique", target, isPreferred: true }),
  }));
  if (openaiToolRunner) {
    vi.doMock("../providers/openai-tools", () => ({
      openaiChatWithTools: openaiToolRunner,
    }));
  }
  vi.doMock("../usage", () => ({ recordModelCall: vi.fn().mockResolvedValue(undefined) }));
  vi.resetModules();
  const mod = await import("./critic-agent");
  return mod.criticAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
  vi.doUnmock("../providers/openai-tools");
  vi.doUnmock("../usage");
  vi.resetModules();
});

describe("criticAgent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a fallback critique when no LLM is configured", async () => {
    const routeChat = vi.fn();
    const agent = await loadCriticAgent({ hasAny: false, routeChat });
    const { events, emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(routeChat).not.toHaveBeenCalled();
    expect(report.verdict).toBe("approved_with_notes");
    expect(report.notes.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("agent_start");
    expect(events[events.length - 1].type).toBe("agent_done");
  });

  it("parses a valid JSON critique response", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        verdict: "needs_revision",
        summary: "missing stuff",
        notes: [
          { field: "acceptanceCriteria", severity: "warning", message: "too vague" },
        ],
      }),
    });
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(report.verdict).toBe("needs_revision");
    expect(report.notes).toHaveLength(1);
    expect(report.summary).toBe("missing stuff");
  });

  it("parses a critique wrapped in ```json fences", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: "```json\n" + JSON.stringify({
        verdict: "approved",
        summary: "ok",
        notes: [],
      }) + "\n```",
    });
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(report.verdict).toBe("approved");
  });

  it("falls back when the model returns invalid JSON", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "not json at all" });
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(report.verdict).toBe("approved_with_notes");
    expect(report.notes.length).toBeGreaterThan(0);
    const progressMessages = events
      .filter((e) => e.type === "agent_progress")
      .map((e) => (e.type === "agent_progress" ? e.message : ""));
    expect(progressMessages.some((m) => /fallback/i.test(m))).toBe(true);
  });

  it("falls back when the response shape is missing `notes`", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: JSON.stringify({ verdict: "approved", summary: "hi" }),
    });
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(Array.isArray(report.notes)).toBe(true);
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it("falls back when the LLM call throws", async () => {
    const routeChat = vi.fn().mockRejectedValue(new Error("network"));
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    const report = await agent.run(DRAFT, { emit });
    expect(report.notes.length).toBeGreaterThan(0);
    const err = events.find(
      (e) => e.type === "agent_progress" && /network/i.test(e.message),
    );
    expect(err).toBeDefined();
  });

  describe("tool-use path (OpenAI)", () => {
    it("invokes openaiChatWithTools when OpenAI is the target and returns toolCalls", async () => {
      const toolCalls = [
        {
          name: "listExistingTicketTitles",
          args: { limit: 50 },
          resultPreview: '{"count":0,"titles":[]}',
          durationMs: 12,
        },
      ];
      const toolRunner = vi.fn(async (params: { onToolCall?: (r: unknown) => void }) => {
        params.onToolCall?.(toolCalls[0]);
        return {
          text: JSON.stringify({
            verdict: "approved_with_notes",
            summary: "looks fine",
            notes: [{ field: "general", severity: "info", message: "nit" }],
          }),
          model: "gpt-4o",
          provider: "openai",
          usage: { inputTokens: 123, outputTokens: 45 },
          toolCalls,
        };
      });
      const routeChat = vi.fn();
      const agent = await loadCriticAgent({
        hasAny: true,
        routeChat,
        target: { provider: "openai", model: "gpt-4o", rationale: "t" },
        openaiConfigured: true,
        openaiToolRunner: toolRunner,
      });
      const { events, emit } = collector();
      const report = await agent.run(DRAFT, { emit });
      expect(toolRunner).toHaveBeenCalledTimes(1);
      expect(routeChat).not.toHaveBeenCalled();
      expect(report.verdict).toBe("approved_with_notes");
      expect(report.toolCalls).toHaveLength(1);
      expect(report.toolCalls?.[0].name).toBe("listExistingTicketTitles");
      const toolMsg = events.find(
        (e) => e.type === "agent_progress" && /listExistingTicketTitles/.test(e.message),
      );
      expect(toolMsg).toBeDefined();
    });

    it("falls back to plain routeChat if the tool-use path throws", async () => {
      const toolRunner = vi.fn().mockRejectedValue(new Error("tool loop boom"));
      const routeChat = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          verdict: "approved",
          summary: "ok",
          notes: [{ field: "general", severity: "info", message: "nit" }],
        }),
      });
      const agent = await loadCriticAgent({
        hasAny: true,
        routeChat,
        target: { provider: "openai", model: "gpt-4o", rationale: "t" },
        openaiConfigured: true,
        openaiToolRunner: toolRunner,
      });
      const { events, emit } = collector();
      const report = await agent.run(DRAFT, { emit });
      expect(toolRunner).toHaveBeenCalledTimes(1);
      expect(routeChat).toHaveBeenCalledTimes(1);
      expect(report.verdict).toBe("approved");
      const progress = events.find(
        (e) => e.type === "agent_progress" && /tool-use path failed/i.test(e.message),
      );
      expect(progress).toBeDefined();
    });

    it("does not invoke tool-use when OpenAI is not configured even if target is openai", async () => {
      const toolRunner = vi.fn();
      const routeChat = vi.fn().mockResolvedValue({
        text: JSON.stringify({ verdict: "approved", summary: "ok", notes: [] }),
      });
      const agent = await loadCriticAgent({
        hasAny: true,
        routeChat,
        target: { provider: "openai", model: "gpt-4o", rationale: "t" },
        openaiConfigured: false,
        openaiToolRunner: toolRunner,
      });
      const { emit } = collector();
      await agent.run(DRAFT, { emit });
      expect(toolRunner).not.toHaveBeenCalled();
      expect(routeChat).toHaveBeenCalledTimes(1);
    });
  });

  it("emits a progress event summarizing the verdict on success", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        verdict: "approved_with_notes",
        summary: "looks fine",
        notes: [
          { field: "general", severity: "info", message: "nit" },
          { field: "edgeCases", severity: "warning", message: "add one" },
        ],
      }),
    });
    const agent = await loadCriticAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    await agent.run(DRAFT, { emit });
    const progress = events.find(
      (e) => e.type === "agent_progress" && /verdict/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });
});
