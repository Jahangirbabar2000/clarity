import { describe, it, expect, afterEach, vi } from "vitest";
import type { AgentEvent } from "./agents";

afterEach(() => {
  vi.doUnmock("./agents");
  vi.resetModules();
});

async function loadPipelineWithMockAgents() {
  const contextRun = vi.fn().mockImplementation(async (_input: string, ctx: { emit: (e: AgentEvent) => void }) => {
    ctx.emit({
      type: "agent_start",
      agent: "ContextAgent",
      role: "rag",
      task: "long_context_summary",
      target: { provider: "google", model: "gemini-2.5-pro" },
      message: "starting",
      startedAt: 1,
    });
    ctx.emit({ type: "agent_done", agent: "ContextAgent", durationMs: 1 });
    return { raw: { files: ["f.ts"] }, brief: "brief" };
  });
  const writerRun = vi.fn().mockImplementation(async (_input: unknown, ctx: { emit: (e: AgentEvent) => void }) => {
    ctx.emit({
      type: "agent_start",
      agent: "TicketWriterAgent",
      role: "write",
      task: "creative_longform",
      target: { provider: "anthropic", model: "claude-sonnet-4-5" },
      message: "writing",
      startedAt: 2,
    });
    ctx.emit({ type: "agent_stream", agent: "TicketWriterAgent", text: "{...}" });
    ctx.emit({ type: "agent_done", agent: "TicketWriterAgent", durationMs: 2 });
    return { ticket: { title: "X" }, subtasks: [] };
  });
  const criticRun = vi.fn().mockImplementation(async (_input: unknown, ctx: { emit: (e: AgentEvent) => void }) => {
    ctx.emit({
      type: "agent_start",
      agent: "CriticAgent",
      role: "review",
      task: "critique",
      target: { provider: "openai", model: "gpt-4o" },
      message: "reviewing",
      startedAt: 3,
    });
    ctx.emit({ type: "agent_done", agent: "CriticAgent", durationMs: 3 });
    return { verdict: "approved_with_notes", summary: "ok", notes: [] };
  });

  vi.doMock("./agents", () => ({
    contextAgent: { run: contextRun, name: "ContextAgent", role: "rag", task: "long_context_summary" },
    ticketWriterAgent: { run: writerRun, name: "TicketWriterAgent", role: "write", task: "creative_longform" },
    criticAgent: { run: criticRun, name: "CriticAgent", role: "review", task: "critique" },
  }));
  vi.resetModules();
  const { runBuildTicketPipeline } = await import("./pipeline");
  return { runBuildTicketPipeline, contextRun, writerRun, criticRun };
}

describe("runBuildTicketPipeline", () => {
  it("runs Context → Writer → Critic in order and forwards their events", async () => {
    const { runBuildTicketPipeline, contextRun, writerRun, criticRun } =
      await loadPipelineWithMockAgents();

    const events: AgentEvent[] = [];
    const result = await runBuildTicketPipeline("an idea", "org-1", (e) => events.push(e));

    const ctxOrder = contextRun.mock.invocationCallOrder[0];
    const writerOrder = writerRun.mock.invocationCallOrder[0];
    const criticOrder = criticRun.mock.invocationCallOrder[0];
    expect(ctxOrder).toBeLessThan(writerOrder);
    expect(writerOrder).toBeLessThan(criticOrder);

    expect(contextRun).toHaveBeenCalledWith("org-1", expect.any(Object));
    expect(writerRun).toHaveBeenCalledWith(
      expect.objectContaining({ idea: "an idea", context: expect.any(Object) }),
      expect.any(Object),
    );

    const agentsInOrder = events
      .filter((e) => e.type === "agent_start")
      .map((e) => (e.type === "agent_start" ? e.agent : ""));
    expect(agentsInOrder).toEqual(["ContextAgent", "TicketWriterAgent", "CriticAgent"]);

    expect(result.context.brief).toBe("brief");
    expect(result.draft.ticket.title).toBe("X");
    expect(result.critique.verdict).toBe("approved_with_notes");
  });

  it("stops when an agent rejects and propagates the error", async () => {
    const contextRun = vi.fn().mockResolvedValue({ raw: {}, brief: null });
    const writerRun = vi.fn().mockRejectedValue(new Error("writer crashed"));
    const criticRun = vi.fn();
    vi.doMock("./agents", () => ({
      contextAgent: { run: contextRun, name: "ContextAgent", role: "rag", task: "x" },
      ticketWriterAgent: { run: writerRun, name: "TicketWriterAgent", role: "write", task: "x" },
      criticAgent: { run: criticRun, name: "CriticAgent", role: "review", task: "x" },
    }));
    vi.resetModules();
    const { runBuildTicketPipeline } = await import("./pipeline");
    await expect(runBuildTicketPipeline("idea", "org-1", () => {})).rejects.toThrow("writer crashed");
    expect(criticRun).not.toHaveBeenCalled();
  });
});
