import { describe, it, expect } from "vitest";
import { reduceAgentEvents } from "./AgentTimeline";
import type { AgentEvent } from "@/types/agents";

function makeStart(agent: string, startedAt = 0): AgentEvent {
  return {
    type: "agent_start",
    agent,
    role: `${agent} role`,
    task: "critique",
    target: { provider: "openai", model: "gpt-4o" },
    message: `${agent} starting`,
    startedAt,
  };
}

describe("reduceAgentEvents", () => {
  it("produces one item per agent_start and attaches done / progress to the correct invocation", () => {
    const events: AgentEvent[] = [
      makeStart("ContextAgent", 1),
      { type: "agent_done", agent: "ContextAgent", durationMs: 10 },
      makeStart("TicketWriterAgent", 2),
      { type: "agent_progress", agent: "TicketWriterAgent", message: "writing…" },
      { type: "agent_done", agent: "TicketWriterAgent", durationMs: 20 },
    ];
    const items = reduceAgentEvents(events);
    expect(items).toHaveLength(2);
    expect(items[0].kind).toBe("agent");
    if (items[0].kind === "agent") {
      expect(items[0].name).toBe("ContextAgent");
      expect(items[0].status).toBe("done");
      expect(items[0].durationMs).toBe(10);
    }
    if (items[1].kind === "agent") {
      expect(items[1].progress).toEqual(["writing…"]);
      expect(items[1].durationMs).toBe(20);
    }
  });

  it("re-invocation: shows the same agent twice when reflection loop runs it again", () => {
    const events: AgentEvent[] = [
      makeStart("TicketWriterAgent", 1),
      { type: "agent_done", agent: "TicketWriterAgent", durationMs: 15 },
      {
        type: "reflection",
        iteration: 2,
        maxIterations: 3,
        verdict: "needs_revision",
        message: "asking writer to revise",
      },
      makeStart("TicketWriterAgent", 2),
      { type: "agent_progress", agent: "TicketWriterAgent", message: "revising" },
      { type: "agent_done", agent: "TicketWriterAgent", durationMs: 25 },
    ];
    const items = reduceAgentEvents(events);

    expect(items).toHaveLength(3);
    expect(items[0].kind).toBe("agent");
    expect(items[1].kind).toBe("reflection");
    expect(items[2].kind).toBe("agent");

    if (items[0].kind === "agent") expect(items[0].durationMs).toBe(15);
    if (items[2].kind === "agent") {
      expect(items[2].durationMs).toBe(25);
      expect(items[2].progress).toEqual(["revising"]);
    }
    if (items[1].kind === "reflection") {
      expect(items[1].iteration).toBe(2);
      expect(items[1].verdict).toBe("needs_revision");
    }
  });

  it("agent_error marks the most recent invocation of that agent as errored", () => {
    const events: AgentEvent[] = [
      makeStart("CriticAgent", 1),
      { type: "agent_error", agent: "CriticAgent", message: "boom" },
    ];
    const items = reduceAgentEvents(events);
    expect(items).toHaveLength(1);
    if (items[0].kind === "agent") {
      expect(items[0].status).toBe("error");
      expect(items[0].error).toBe("boom");
    }
  });
});
