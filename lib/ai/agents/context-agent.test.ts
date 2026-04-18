import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentEvent } from "./base";

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

const MOCK_CONTEXT = {
  techStack: ["TypeScript", "Next.js"],
  existingServices: ["api"],
  relevantFiles: [
    { path: "app/api/foo/route.ts", summary: "foo handler" },
    { path: "lib/bar.ts", summary: "bar util" },
  ],
  recentTicketTitles: ["Old ticket"],
  jiraStyleSamples: ["CLAR-1 Existing"],
  prdExcerpt: "",
  notionExcerpt: "",
  sources: { github: true, jira: true, notion: false, prd: false, existingTickets: 1 },
};

async function loadContextAgent({
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
      task: "long_context_summary",
      target: { provider: "google", model: "gemini-2.5-pro", rationale: "test" },
      isPreferred: true,
    }),
  }));
  vi.doMock("@/lib/context/context-assembler", () => ({
    assembleContext: vi.fn().mockResolvedValue(MOCK_CONTEXT),
  }));
  vi.resetModules();
  return (await import("./context-agent")).contextAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
  vi.doUnmock("@/lib/context/context-assembler");
  vi.resetModules();
});

describe("contextAgent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns raw context with null brief when no LLM is configured", async () => {
    const routeChat = vi.fn();
    const agent = await loadContextAgent({ hasAny: false, routeChat });
    const { emit } = collector();
    const result = await agent.run("org1", { emit });
    expect(result.raw).toBe(MOCK_CONTEXT);
    expect(result.brief).toBeNull();
    expect(routeChat).not.toHaveBeenCalled();
  });

  it("condenses context into a brief when an LLM is configured", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "  Tech stack: TypeScript. \n" });
    const agent = await loadContextAgent({ hasAny: true, routeChat });
    const { emit } = collector();
    const result = await agent.run("org1", { emit });
    expect(routeChat).toHaveBeenCalledOnce();
    expect(result.raw).toBe(MOCK_CONTEXT);
    expect(result.brief).toBe("Tech stack: TypeScript.");
  });

  it("emits a progress event with the gathered counts", async () => {
    const routeChat = vi.fn().mockResolvedValue({ text: "brief" });
    const agent = await loadContextAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    await agent.run("org1", { emit });
    const progress = events.find(
      (e) => e.type === "agent_progress" && /files|Jira|tickets/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });

  it("falls back to raw context when the LLM call throws", async () => {
    const routeChat = vi.fn().mockRejectedValue(new Error("timeout"));
    const agent = await loadContextAgent({ hasAny: true, routeChat });
    const { events, emit } = collector();
    const result = await agent.run("org1", { emit });
    expect(result.raw).toBe(MOCK_CONTEXT);
    expect(result.brief).toBeNull();
    const progress = events.find(
      (e) => e.type === "agent_progress" && /timeout|failed/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });
});
