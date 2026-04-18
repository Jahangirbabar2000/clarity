import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { AgentEvent } from "./base";
import type { BuildTicketPayload } from "@/types/api";

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

const VALID_PAYLOAD: BuildTicketPayload = {
  ticket: {
    title: "Feature X",
    description: "desc",
    acceptanceCriteria: ["AC1"],
    edgeCases: ["EC1"],
    outOfScope: ["OOS1"],
    type: "FEATURE",
    priority: "HIGH",
    storyPoints: 5,
    suggestedLabels: ["l1"],
  },
  subtasks: [
    {
      title: "S1",
      description: "d",
      type: "BACKEND",
      storyPoints: 2,
      priority: "HIGH",
      dependsOn: [],
      suggestedSprint: 1,
    },
  ],
};

async function loadTicketWriter({
  hasAny,
  routeChatStream,
}: {
  hasAny: boolean;
  routeChatStream: ReturnType<typeof vi.fn>;
}) {
  vi.doMock("../providers", () => ({ hasAnyProvider: () => hasAny }));
  vi.doMock("../router", () => ({
    routeChatStream,
    routeDecision: vi.fn().mockReturnValue({
      task: "creative_longform",
      target: { provider: "anthropic", model: "claude-sonnet-4-5", rationale: "test" },
      isPreferred: true,
    }),
  }));
  vi.resetModules();
  return (await import("./ticket-writer-agent")).ticketWriterAgent;
}

afterEach(() => {
  vi.doUnmock("../providers");
  vi.doUnmock("../router");
  vi.resetModules();
});

describe("ticketWriterAgent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the demo fallback when no LLM is configured and streams it", async () => {
    const routeChatStream = vi.fn();
    const agent = await loadTicketWriter({ hasAny: false, routeChatStream });
    const { events, emit } = collector();
    const result = await agent.run(
      { idea: "x", context: { raw: null as never, brief: null } },
      { emit },
    );
    expect(routeChatStream).not.toHaveBeenCalled();
    expect(result.ticket.title).toMatch(/currency|notification|feature/i);
    const streamed = events.filter((e) => e.type === "agent_stream");
    expect(streamed.length).toBeGreaterThan(0);
  });

  it("parses a valid JSON stream and returns the payload", async () => {
    const payloadStr = JSON.stringify(VALID_PAYLOAD);
    const routeChatStream = vi.fn().mockImplementation(async (_req, onDelta: (d: string) => void) => {
      for (let i = 0; i < payloadStr.length; i += 10) {
        onDelta(payloadStr.slice(i, i + 10));
      }
      return { text: payloadStr, model: "claude-sonnet-4-5", provider: "anthropic" };
    });
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { events, emit } = collector();
    const result = await agent.run(
      { idea: "ship it", context: { raw: null as never, brief: null } },
      { emit },
    );
    expect(result.ticket.title).toBe("Feature X");
    expect(result.subtasks).toHaveLength(1);
    // chunks from the real stream were forwarded to the pipeline
    const streamed = events.filter((e) => e.type === "agent_stream");
    expect(streamed.length).toBeGreaterThan(1);
  });

  it("parses a JSON-fenced stream", async () => {
    const fenced = "```json\n" + JSON.stringify(VALID_PAYLOAD) + "\n```";
    const routeChatStream = vi.fn().mockImplementation(async (_req, onDelta: (d: string) => void) => {
      onDelta(fenced);
      return { text: fenced, model: "x", provider: "anthropic" };
    });
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { emit } = collector();
    const result = await agent.run(
      { idea: "x", context: { raw: null as never, brief: null } },
      { emit },
    );
    expect(result.ticket.title).toBe("Feature X");
  });

  it("falls back to demo payload when stream output is not valid JSON", async () => {
    const routeChatStream = vi.fn().mockImplementation(async (_req, onDelta: (d: string) => void) => {
      onDelta("definitely not json");
      return { text: "definitely not json", model: "x", provider: "anthropic" };
    });
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { events, emit } = collector();
    const result = await agent.run(
      { idea: "x", context: { raw: null as never, brief: null } },
      { emit },
    );
    expect(result.ticket.title).toMatch(/multi-currency/i); // demo fallback
    const progress = events.find(
      (e) => e.type === "agent_progress" && /demo fallback/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });

  it("revision mode: includes previous draft and critique notes in the user payload and switches the system prompt", async () => {
    const payloadStr = JSON.stringify(VALID_PAYLOAD);
    let capturedMessages: Array<{ role: string; content: string }> | null = null;
    const routeChatStream = vi.fn().mockImplementation(
      async (
        req: { messages: Array<{ role: string; content: string }> },
        onDelta: (d: string) => void,
      ) => {
        capturedMessages = req.messages;
        onDelta(payloadStr);
        return { text: payloadStr, model: "claude-sonnet-4-5", provider: "anthropic" };
      },
    );
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { emit } = collector();
    await agent.run(
      {
        idea: "ship it",
        context: { raw: null as never, brief: "brief" },
        revision: {
          iteration: 2,
          previousDraft: VALID_PAYLOAD,
          critique: {
            verdict: "needs_revision",
            summary: "missing rate-limit handling",
            notes: [
              {
                field: "edgeCases",
                severity: "blocker",
                message: "no rate-limit edge case",
                suggestion: "add one",
              },
            ],
          },
        },
      },
      { emit },
    );

    expect(capturedMessages).not.toBeNull();
    const systemMsg = capturedMessages!.find((m) => m.role === "system")!;
    const userMsg = capturedMessages!.find((m) => m.role === "user")!;
    expect(systemMsg.content).toMatch(/REVISION MODE/);

    const parsed = JSON.parse(userMsg.content) as Record<string, unknown>;
    expect(parsed.mode).toBe("revision");
    expect(parsed.revisionIteration).toBe(2);
    expect(parsed.criticVerdict).toBe("needs_revision");
    expect(Array.isArray(parsed.criticNotes)).toBe(true);
    expect((parsed.criticNotes as unknown[])[0]).toMatchObject({
      field: "edgeCases",
      severity: "blocker",
    });
    expect(parsed.previousDraft).toMatchObject({ ticket: { title: "Feature X" } });
  });

  it("initial pass: does NOT include revision hints in the user payload", async () => {
    const payloadStr = JSON.stringify(VALID_PAYLOAD);
    let capturedUserContent = "";
    const routeChatStream = vi.fn().mockImplementation(
      async (
        req: { messages: Array<{ role: string; content: string }> },
        onDelta: (d: string) => void,
      ) => {
        capturedUserContent = req.messages.find((m) => m.role === "user")!.content;
        onDelta(payloadStr);
        return { text: payloadStr, model: "x", provider: "anthropic" };
      },
    );
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { emit } = collector();
    await agent.run(
      { idea: "ship it", context: { raw: null as never, brief: "b" } },
      { emit },
    );
    const parsed = JSON.parse(capturedUserContent) as Record<string, unknown>;
    expect(parsed.mode).toBeUndefined();
    expect(parsed.previousDraft).toBeUndefined();
    expect(parsed.criticNotes).toBeUndefined();
  });

  it("falls back to demo payload when the stream call throws", async () => {
    const routeChatStream = vi.fn().mockRejectedValue(new Error("connection"));
    const agent = await loadTicketWriter({ hasAny: true, routeChatStream });
    const { events, emit } = collector();
    const result = await agent.run(
      { idea: "x", context: { raw: null as never, brief: null } },
      { emit },
    );
    expect(result.ticket.title).toBeTruthy();
    expect(result.subtasks.length).toBeGreaterThan(0);
    const progress = events.find(
      (e) => e.type === "agent_progress" && /connection/i.test(e.message),
    );
    expect(progress).toBeDefined();
  });
});
