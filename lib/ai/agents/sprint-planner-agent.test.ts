import { describe, it, expect } from "vitest";
import { sprintPlannerAgent } from "./sprint-planner-agent";
import type { AgentEvent } from "./base";
import type { Subtask } from "@prisma/client";

function sub(partial: Partial<Subtask> & Pick<Subtask, "id" | "title" | "storyPoints">): Subtask {
  return {
    ticketId: "t1",
    jiraId: null,
    jiraUrl: null,
    description: "",
    type: "BACKEND",
    priority: "MED",
    dependsOn: [],
    suggestedSprint: null,
    order: 0,
    ...partial,
  } as Subtask;
}

describe("sprintPlannerAgent", () => {
  it("declares itself as deterministic (task === null)", () => {
    expect(sprintPlannerAgent.task).toBeNull();
    expect(sprintPlannerAgent.name).toBe("SprintPlannerAgent");
  });

  it("emits start + progress + done with no target", async () => {
    const events: AgentEvent[] = [];
    const result = await sprintPlannerAgent.run(
      {
        subtasks: [
          sub({ id: "a", title: "A", storyPoints: 3 }),
          sub({ id: "b", title: "B", storyPoints: 2 }),
        ],
        velocityPerSprint: 20,
        sprintLengthWeeks: 2,
      },
      { emit: (e) => events.push(e) },
    );
    expect(result).toHaveLength(1);
    expect(result[0].committedPoints).toBe(5);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("agent_start");
    expect(types).toContain("agent_progress");
    expect(types[types.length - 1]).toBe("agent_done");

    // target must be null for a deterministic agent
    const start = events[0];
    if (start.type !== "agent_start") throw new Error("wrong");
    expect(start.target).toBeNull();
  });

  it("produces deterministic output for the same input", async () => {
    const subs = [
      sub({ id: "a", title: "A", storyPoints: 5 }),
      sub({ id: "b", title: "B", storyPoints: 5, dependsOn: ["A"] }),
      sub({ id: "c", title: "C", storyPoints: 3 }),
    ];
    const r1 = await sprintPlannerAgent.run(
      { subtasks: subs, velocityPerSprint: 8, sprintLengthWeeks: 2 },
      { emit: () => {} },
    );
    const r2 = await sprintPlannerAgent.run(
      { subtasks: subs, velocityPerSprint: 8, sprintLengthWeeks: 2 },
      { emit: () => {} },
    );
    expect(r1.map((s) => s.subtasks.map((st) => st.id))).toEqual(
      r2.map((s) => s.subtasks.map((st) => st.id)),
    );
  });
});
