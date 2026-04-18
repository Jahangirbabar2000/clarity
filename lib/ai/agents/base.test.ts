import { describe, it, expect, vi } from "vitest";
import { runAgent, type AgentEvent, type AgentMeta } from "./base";

const meta: AgentMeta = {
  name: "TestAgent",
  role: "For testing",
  task: "critique",
};

function collector() {
  const events: AgentEvent[] = [];
  return { events, emit: (e: AgentEvent) => events.push(e) };
}

describe("runAgent", () => {
  it("emits agent_start then agent_done for successful runs", async () => {
    const { events, emit } = collector();
    const result = await runAgent(
      meta,
      { provider: "openai", model: "gpt-4o" },
      "starting",
      { emit },
      async () => 42,
    );
    expect(result).toBe(42);
    expect(events.map((e) => e.type)).toEqual(["agent_start", "agent_done"]);
    const start = events[0];
    if (start.type !== "agent_start") throw new Error("wrong event");
    expect(start.agent).toBe("TestAgent");
    expect(start.role).toBe("For testing");
    expect(start.task).toBe("critique");
    expect(start.target).toEqual({ provider: "openai", model: "gpt-4o" });
    expect(start.message).toBe("starting");
    expect(typeof start.startedAt).toBe("number");
  });

  it("emits agent_error AND rethrows on failure", async () => {
    const { events, emit } = collector();
    await expect(
      runAgent(meta, null, "x", { emit }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(events.map((e) => e.type)).toEqual(["agent_start", "agent_error"]);
    const err = events[1];
    if (err.type !== "agent_error") throw new Error("wrong event");
    expect(err.message).toBe("boom");
  });

  it("does NOT emit agent_done after an error", async () => {
    const { events, emit } = collector();
    await expect(
      runAgent(meta, null, "x", { emit }, async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow();
    expect(events.some((e) => e.type === "agent_done")).toBe(false);
  });

  it("records a non-negative duration in agent_done", async () => {
    const { events, emit } = collector();
    await runAgent(meta, null, "x", { emit }, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return null;
    });
    const done = events.find((e) => e.type === "agent_done");
    if (!done || done.type !== "agent_done") throw new Error("missing");
    expect(done.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("handles non-Error throwables by stringifying them", async () => {
    const { events, emit } = collector();
    await expect(
      runAgent(meta, null, "x", { emit }, async () => {
        throw "just a string"; // eslint-disable-line no-throw-literal
      }),
    ).rejects.toBe("just a string");
    const err = events[1];
    if (err.type !== "agent_error") throw new Error("wrong");
    expect(err.message).toBe("just a string");
  });

  it("passes through intermediate agent_progress events emitted from body", async () => {
    const { events, emit } = collector();
    await runAgent(meta, null, "x", { emit }, async () => {
      emit({ type: "agent_progress", agent: "TestAgent", message: "halfway" });
      return "ok";
    });
    expect(events.map((e) => e.type)).toEqual(["agent_start", "agent_progress", "agent_done"]);
  });
});

describe("AgentEvent discriminated union", () => {
  it("all shapes carry a required `type`", () => {
    const samples: AgentEvent[] = [
      { type: "agent_start", agent: "a", role: "r", task: null, target: null, message: "m", startedAt: 0 },
      { type: "agent_progress", agent: "a", message: "m" },
      { type: "agent_stream", agent: "a", text: "t" },
      { type: "agent_done", agent: "a", durationMs: 1 },
      { type: "agent_error", agent: "a", message: "oops" },
    ];
    for (const s of samples) expect(s.type).toBeTruthy();
  });
});

it("runAgent is not exported as a side-effect-only symbol", () => {
  expect(typeof runAgent).toBe("function");
});

// silence unused-import lint by referencing vi (Vitest's spy API)
void vi;
