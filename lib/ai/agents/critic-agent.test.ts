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
}: {
  hasAny: boolean;
  routeChat: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("../providers", () => ({
    hasAnyProvider: () => hasAny,
  }));
  vi.doMock("../router", () => ({
    routeChat,
    routeDecision: vi.fn().mockReturnValue({
      task: "critique",
      target: { provider: "openai", model: "gpt-4o", rationale: "test" },
      isPreferred: true,
    }),
  }));
  vi.resetModules();
  const mod = await import("./critic-agent");
  return mod.criticAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
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
