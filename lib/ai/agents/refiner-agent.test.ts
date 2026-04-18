import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentEvent } from "./base";

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

async function loadRefinerAgent({
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
      task: "refinement",
      target: { provider: "anthropic", model: "claude-haiku-4-5", rationale: "test" },
      isPreferred: true,
    }),
  }));
  vi.resetModules();
  return (await import("./refiner-agent")).refinerAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
  vi.resetModules();
});

describe("refinerAgent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns a mock refinement when no LLM is configured (string field)", async () => {
    const routeChat = vi.fn();
    const agent = await loadRefinerAgent({ hasAny: false, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "title",
        currentValue: "original title",
        editRequest: "make it punchier",
        ticketContext: { title: "original title", description: "desc" },
      },
      { emit },
    );
    expect(routeChat).not.toHaveBeenCalled();
    expect(typeof result).toBe("string");
    expect(result).toContain("original title");
    expect(result).toContain("make it punchier");
  });

  it("returns a mock refinement appending to an array field when no LLM", async () => {
    const routeChat = vi.fn();
    const agent = await loadRefinerAgent({ hasAny: false, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "acceptanceCriteria",
        currentValue: ["AC1", "AC2"],
        editRequest: "add latency bound",
        ticketContext: { title: "t", description: "d" },
      },
      { emit },
    );
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[])).toHaveLength(3);
    expect((result as string[])[2]).toMatch(/latency bound/);
  });

  it("parses a raw JSON array from the LLM for array fields", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: JSON.stringify(["new AC 1", "new AC 2"]),
    });
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "acceptanceCriteria",
        currentValue: ["old"],
        editRequest: "rewrite",
        ticketContext: { title: "t", description: "d" },
      },
      { emit },
    );
    expect(result).toEqual(["new AC 1", "new AC 2"]);
  });

  it("parses a JSON-fenced response for array fields", async () => {
    const routeChat = vi.fn().mockResolvedValue({
      text: "```json\n" + JSON.stringify(["a", "b"]) + "\n```",
    });
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "edgeCases",
        currentValue: [],
        editRequest: "add two",
        ticketContext: { title: "t", description: "d" },
      },
      { emit },
    );
    expect(result).toEqual(["a", "b"]);
  });

  it("returns a plain string for title refinement when the LLM returns unquoted text", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "Shorter Title" });
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "title",
        currentValue: "Long original title",
        editRequest: "shorten",
        ticketContext: { title: "Long original title", description: "d" },
      },
      { emit },
    );
    expect(result).toBe("Shorter Title");
  });

  it("returns a plain string for description refinement when not JSON", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "A rewritten description." });
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run(
      {
        field: "description",
        currentValue: "old",
        editRequest: "rewrite",
        ticketContext: { title: "t", description: "old" },
      },
      { emit },
    );
    expect(result).toBe("A rewritten description.");
  });

  it("falls back to original value on non-string/array fields when JSON parse fails", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "totally not json" });
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const current = [{ title: "s1" }];
    const result = await agent.run(
      {
        field: "subtasks",
        currentValue: current,
        editRequest: "add test",
        ticketContext: { title: "t", description: "d" },
      },
      { emit },
    );
    expect(result).toBe(current);
  });

  it("falls back to a mock refinement when LLM call throws", async () => {
    const routeChat = vi.fn().mockRejectedValue(new Error("down"));
    const agent = await loadRefinerAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    const result = await agent.run(
      {
        field: "title",
        currentValue: "orig",
        editRequest: "make it better",
        ticketContext: { title: "orig", description: "d" },
      },
      { emit },
    );
    expect(result).toContain("orig");
    const progress = events.find(
      (e) => e.type === "agent_progress" && /down|failed/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });
});
